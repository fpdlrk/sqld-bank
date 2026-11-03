/**
 * TP09 (S2-05) ROWNUM과 ORDER BY 순서 / FETCH FIRST — 결과 목록 (docs/04 §7)
 *
 * SQLite에는 ROWNUM이 없으므로 docs/04 §6 규칙으로 바꿔 실행한다.
 *   WHERE ROWNUM <= n ORDER BY x   → 저장 순서(rowid)대로 n행을 고른 뒤 정렬
 *   (… ORDER BY x) WHERE ROWNUM <= n → 정렬한 뒤 앞에서 n행 (LIMIT)
 *   FETCH FIRST n ROWS ONLY         → LIMIT n
 * 결과가 하나로 정해지도록 급여는 서로 다르게 만들고,
 * 본문에 "행은 표에 보이는 순서대로 저장되어 있다"고 밝힌다.
 */
import type { CellValue, TableData } from '../../domain'
import { defineTemplate, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { pickNames } from './data'

/** 결과의 ENAME 목록 → "KIM, LEE, PARK" */
const names = (r: TableData) => r.rows.map((row) => String(row[0])).join(', ')

const firstNThenSort = (n: number, dir: string) => ({
  sql: `SELECT ENAME, SAL FROM (SELECT ENAME, SAL FROM EMP ORDER BY rowid LIMIT ${n}) ORDER BY SAL ${dir}`,
  format: names,
})
const sortThenFirstN = (n: number, dir: string) => ({
  sql: `SELECT ENAME, SAL FROM EMP ORDER BY SAL ${dir} LIMIT ${n}`,
  format: names,
})
const firstNUnsorted = (n: number) => ({
  sql: `SELECT ENAME, SAL FROM EMP ORDER BY rowid LIMIT ${n}`,
  format: names,
})

type Variant = 'rownum' | 'inline' | 'fetch'

export const TP09 = defineTemplate({
  id: 'TP09',
  subject: 2,
  chapter: 'S2-05',
  topic: 'ROWNUM과 ORDER BY 순서',
  type: 'sql_result',
  difficulty: 3,
  tags: ['ROWNUM', 'Top N', 'ORDER BY', '인라인 뷰', 'FETCH FIRST'],
  build(rng: Rng): TemplateScenario {
    const count = rng.int(6, 8)
    const sals = rng.shuffle(Array.from({ length: 16 }, (_, i) => 1000 + i * 200)).slice(0, count) // 서로 다른 급여
    const rows: CellValue[][] = pickNames(rng, count).map((name, i) => [i + 1, name, sals[i] ?? 1000])
    const n = rng.int(2, 3)
    const dir = rng.chance(0.75) ? 'DESC' : 'ASC'
    const flip = dir === 'DESC' ? 'ASC' : 'DESC'
    const variant = rng.pick<Variant>(['rownum', 'rownum', 'inline', 'fetch'])

    const display = {
      rownum: `SELECT ENAME, SAL\n  FROM EMP\n WHERE ROWNUM <= ${n}\n ORDER BY SAL ${dir};`,
      inline: `SELECT ENAME, SAL\n  FROM (SELECT ENAME, SAL\n          FROM EMP\n         ORDER BY SAL ${dir})\n WHERE ROWNUM <= ${n};`,
      fetch: `SELECT ENAME, SAL\n  FROM EMP\n ORDER BY SAL ${dir}\n FETCH FIRST ${n} ROWS ONLY;`,
    }[variant]

    const scenario: Omit<TemplateScenario, 'answer' | 'traps' | 'explain' | 'examPoint'> = {
      tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'SAL'], rows }],
      stem: `다음 [EMP] 테이블에 SQL을 실행한 결과의 ENAME을 위에서부터 차례로 나열한 것은? (EMP의 행은 표에 보이는 순서대로 저장되어 있다)`,
      sql: display,
    }
    const big = dir === 'DESC' ? '큰' : '작은'

    if (variant === 'rownum') {
      return {
        ...scenario,
        answer: firstNThenSort(n, dir),
        traps: [
          { ...sortThenFirstN(n, dir), why: 'ORDER BY가 ROWNUM보다 먼저 적용되어 급여 상위 행을 고른다고 본' },
          { ...firstNUnsorted(n), why: 'ORDER BY를 무시하고 저장 순서 그대로 나열한' },
          { ...firstNThenSort(n, flip), why: '정렬 방향을 반대로 본' },
        ],
        explain: ({ answerMark, answerText }) =>
          `정답은 ${answerMark}(${answerText})입니다. ROWNUM은 WHERE 절을 처리하면서 행을 읽는 순서대로 매겨지고, ORDER BY는 그 뒤에 실행됩니다. 따라서 이 SQL은 "급여 상위 ${n}명"이 아니라 **저장 순서상 앞의 ${n}행을 먼저 고른 뒤** 그 ${n}행만 급여 순으로 정렬합니다. 급여 상위 ${n}명을 구하려면 ORDER BY를 인라인 뷰 안에 넣고 바깥에서 ROWNUM으로 잘라야 합니다.`,
        examPoint: 'ROWNUM은 ORDER BY보다 먼저 매겨진다 — Top N은 "인라인 뷰에서 정렬 → 바깥에서 ROWNUM".',
      }
    }
    const what = variant === 'inline' ? '인라인 뷰 안에서 먼저 정렬한 뒤 바깥 쿼리에서 ROWNUM으로' : 'ORDER BY로 정렬한 뒤 FETCH FIRST로'
    return {
      ...scenario,
      answer: sortThenFirstN(n, dir),
      traps: [
        { ...firstNThenSort(n, dir), why: '정렬 전에 저장 순서대로 행을 먼저 고른다고 본' },
        { ...firstNUnsorted(n), why: '정렬을 무시하고 저장 순서 그대로 나열한' },
        { ...sortThenFirstN(n, flip), why: `정렬 방향을 반대로(급여가 ${dir === 'DESC' ? '작은' : '큰'} 순서로) 본` },
      ],
      explain: ({ answerMark, answerText }) =>
        `정답은 ${answerMark}(${answerText})입니다. 이 SQL은 ${what} 앞의 ${n}행을 자르므로, 급여가 가장 ${big} ${n}명이 급여 순서대로 나옵니다. ROWNUM을 정렬과 같은 쿼리 블록의 WHERE에 쓰면 정렬 전에 행이 잘린다는 점과 비교해 두세요.`,
      examPoint:
        variant === 'inline'
          ? 'Top N 쿼리: 인라인 뷰에서 ORDER BY → 바깥 쿼리에서 ROWNUM <= N.'
          : 'FETCH FIRST n ROWS ONLY는 ORDER BY 뒤에 적용된다 (Oracle 12c 이상).',
    }
  },
})
