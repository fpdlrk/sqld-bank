/**
 * TP13 (S1-06) ORDER BY와 NULL의 위치 — docs/04 §7
 * 변형: ASC/DESC × (기본 / NULLS FIRST / NULLS LAST)
 *
 * Oracle은 NULL을 가장 큰 값으로 보아 ASC에서 마지막, DESC에서 처음에 둔다.
 * SQLite는 반대이므로 실행용 SQL에는 항상 NULLS FIRST/LAST를 명시한다 (docs/04 §6).
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { pickIndexes, pickNames } from './data'

type Dir = 'ASC' | 'DESC'
type Nulls = 'NULLS FIRST' | 'NULLS LAST'

/** Oracle 기본 NULL 위치 */
const oracleDefault = (dir: Dir): Nulls => (dir === 'ASC' ? 'NULLS LAST' : 'NULLS FIRST')
const flip = (n: Nulls): Nulls => (n === 'NULLS FIRST' ? 'NULLS LAST' : 'NULLS FIRST')
const first = (dir: Dir, nulls: Nulls, where = '') => ({
  sql: `SELECT ENAME FROM EMP ${where} ORDER BY COMM ${dir} ${nulls}, EMPNO LIMIT 1`,
  format: format.value,
})

export const TP13 = defineTemplate({
  id: 'TP13',
  subject: 2,
  chapter: 'S1-06',
  topic: 'ORDER BY와 NULL의 위치',
  type: 'sql_result',
  difficulty: 2,
  tags: ['ORDER BY', 'NULL', 'NULLS FIRST', 'NULLS LAST'],
  build(rng: Rng): TemplateScenario {
    const n = rng.int(6, 9)
    const names = pickNames(rng, n)
    const nullAt = pickIndexes(rng, n, rng.int(1, 3))
    const comms = rng.shuffle([...Array(12).keys()].map((k) => (k + 1) * 100)).slice(0, n)
    const rows: CellValue[][] = names.map((name, i) => [i + 1, name, nullAt.has(i) ? null : (comms[i] ?? 100)])

    const dir: Dir = rng.pick(['ASC', 'DESC'] as const)
    const explicit: Nulls | null = rng.pick([null, null, 'NULLS FIRST', 'NULLS LAST'] as const)
    const nulls = explicit ?? oracleDefault(dir)
    const other: Dir = dir === 'ASC' ? 'DESC' : 'ASC'
    const dirText = dir === 'ASC' ? rng.pick(['', ' ASC']) : ' DESC'

    return {
      tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'COMM'], rows }],
      stem: '다음 [EMP] 테이블에 Oracle에서 SQL을 실행했을 때 결과의 **첫 번째 행**의 ENAME으로 알맞은 것은?',
      sql: `SELECT ENAME\n  FROM EMP\n ORDER BY COMM${dirText}${explicit ? ` ${explicit}` : ''}, EMPNO;`,
      answer: first(dir, nulls),
      traps: [
        {
          ...first(dir, flip(nulls)),
          why: explicit ? `${explicit}를 반대로 적용한` : 'SQL Server처럼 NULL을 가장 작은 값으로 본',
        },
        { ...first(other, explicit ?? oracleDefault(other)), why: '정렬 방향을 반대로 본' },
        { ...first(dir, nulls, 'WHERE COMM IS NOT NULL'), why: 'NULL인 행은 정렬 결과에서 빠진다고 본' },
        {
          sql: 'SELECT ENAME FROM EMP WHERE COMM IS NULL ORDER BY EMPNO DESC LIMIT 1',
          format: format.value,
          why: 'NULL끼리의 순서를 EMPNO 역순으로 본',
        },
      ],
      fillers: names,
      explain: ({ answerMark, answerText }) => {
        const rule = explicit
          ? `${explicit}를 명시했으므로 정렬 방향과 상관없이 NULL인 행이 ${explicit === 'NULLS FIRST' ? '맨 앞' : '맨 뒤'}에 옵니다.`
          : `Oracle은 NULL을 가장 큰 값으로 취급하므로 ${dir === 'ASC' ? '오름차순(ASC)에서는 NULL이 맨 뒤' : '내림차순(DESC)에서는 NULL이 맨 앞'}에 옵니다.`
        return `정답은 ${answerMark}(${answerText})입니다. ${rule} NULL이 아닌 행은 COMM ${dir === 'ASC' ? '오름차순' : '내림차순'}으로, COMM이 같거나 NULL끼리는 EMPNO 순으로 놓입니다. SQL Server처럼 NULL을 가장 작은 값으로 보는 DBMS와 결과가 반대라는 점이 자주 출제됩니다.`
      },
      examPoint: 'Oracle: NULL은 가장 큰 값 → ASC면 맨 뒤, DESC면 맨 앞. NULLS FIRST/LAST로 바꿀 수 있다.',
    }
  },
})
