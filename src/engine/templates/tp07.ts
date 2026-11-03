/**
 * TP07 (S2-04) RANK / DENSE_RANK / ROW_NUMBER — 특정 행의 순위 값 (docs/04 §7)
 *
 * ⚠ ROW_NUMBER는 같은 값끼리의 순서가 Oracle에서 정해져 있지 않다.
 *   그래서 ROW_NUMBER 값을 묻거나 함정으로 실행할 때는 대상 행의 값이 (전체 테이블에서) 겹치지 않을 때만 쓴다.
 *   값이 겹치는 행에 대한 "ROW_NUMBER처럼 센" 함정은 RANK + 1을 글자로 만든다.
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario, type TrapProbe } from '../template'
import { pickNames } from './data'

type RankFn = 'RANK' | 'DENSE_RANK' | 'ROW_NUMBER'
const FNS: RankFn[] = ['RANK', 'DENSE_RANK', 'ROW_NUMBER']

const WHY: Record<RankFn, string> = {
  RANK: '동순위 다음 순위를 건너뛰는 RANK로 계산한',
  DENSE_RANK: '동순위 다음 순위를 건너뛰지 않는 DENSE_RANK로 계산한',
  ROW_NUMBER: '같은 값에도 서로 다른 번호를 매기는 ROW_NUMBER로 계산한',
}

const MEANING: Record<RankFn, string> = {
  RANK: 'RANK는 같은 값에 같은 순위를 주고, 그다음 순위는 동순위 수만큼 건너뜁니다 (1, 1, 3 …)',
  DENSE_RANK: 'DENSE_RANK는 같은 값에 같은 순위를 주되, 그다음 순위를 건너뛰지 않습니다 (1, 1, 2 …)',
  ROW_NUMBER: 'ROW_NUMBER는 같은 값이 있어도 행마다 서로 다른 번호를 차례로 매깁니다 (1, 2, 3 …)',
}

const over = (part: boolean, dir: 'DESC' | 'ASC') => `${part ? 'PARTITION BY DEPTNO ' : ''}ORDER BY SAL ${dir}`
const query = (fn: RankFn, part: boolean, dir: 'DESC' | 'ASC') =>
  `SELECT ENAME, DEPTNO, SAL, ${fn}() OVER (${over(part, dir)}) AS RNK FROM EMP`
const valueOf = (fn: RankFn, part: boolean, dir: 'DESC' | 'ASC', name: string) => ({
  sql: `SELECT RNK FROM (${query(fn, part, dir)}) WHERE ENAME = '${name}'`,
  format: format.scalar,
})

export const TP07 = defineTemplate({
  id: 'TP07',
  subject: 2,
  chapter: 'S2-04',
  topic: '순위 함수 결과 값',
  type: 'sql_result',
  difficulty: 2,
  tags: ['윈도우 함수', 'RANK', 'DENSE_RANK', 'ROW_NUMBER', 'PARTITION BY'],
  numericChoices: true,
  build(rng): TemplateScenario {
    const n = rng.int(7, 9)
    const names = pickNames(rng, n)
    // 좁은 범위의 급여 → 같은 값(동순위)이 자연스럽게 생긴다
    const rows: CellValue[][] = names.map((name, i) => [i + 1, name, rng.pick([10, 20]), rng.pick([1500, 2000, 2500, 3000, 3500])])
    const salOf = (r: CellValue[]) => r[3] as number
    const uniqueInTable = rows.filter((r) => rows.filter((x) => salOf(x) === salOf(r)).length === 1)

    const part = rng.chance(0.5)
    const dir: 'DESC' | 'ASC' = rng.chance(0.8) ? 'DESC' : 'ASC'
    let fn = rng.pick(FNS)
    if (fn === 'ROW_NUMBER' && uniqueInTable.length === 0) fn = 'RANK'
    const target = fn === 'ROW_NUMBER' ? rng.pick(uniqueInTable) : rng.pick(rows)
    const name = target[1] as string
    const targetUnique = uniqueInTable.includes(target)

    // 대상 행의 RANK 값 (JS 계산) — 동순위 행에 대한 "ROW_NUMBER처럼" 함정 글자용
    const scope = part ? rows.filter((r) => r[2] === target[2]) : rows
    const better = scope.filter((r) => (dir === 'DESC' ? salOf(r) > salOf(target) : salOf(r) < salOf(target))).length
    const rank = better + 1

    const traps: TrapProbe[] = []
    for (const other of FNS.filter((f) => f !== fn)) {
      if (other === 'ROW_NUMBER' && !targetUnique) traps.push({ text: String(rank + 1), why: WHY.ROW_NUMBER })
      else traps.push({ ...valueOf(other, part, dir, name), why: WHY[other] })
    }
    traps.push({
      ...valueOf(fn, !part, dir, name),
      why: part ? 'PARTITION BY를 빼고 전체 사원 중에서 순위를 매긴' : '부서별로 따로 순위를 매긴다고 본',
    })
    traps.push({
      ...valueOf(fn, part, dir === 'DESC' ? 'ASC' : 'DESC', name),
      why: dir === 'DESC' ? '정렬 방향을 반대로(작은 값이 1위) 본' : '정렬 방향을 반대로(큰 값이 1위) 본',
    })

    const display = `SELECT ENAME, DEPTNO, SAL,\n       ${fn}() OVER (${over(part, dir)}) AS RNK\n  FROM EMP;`
    return {
      tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'DEPTNO', 'SAL'], rows }],
      stem: `다음 [EMP] 테이블에 SQL을 실행했을 때, ENAME이 '${name}'인 행의 RNK 값은?`,
      sql: display,
      answer: valueOf(fn, part, dir, name),
      traps,
      fillers: [rank - 1, rank + 1, rank + 2, rank - 2, rank + 3].filter((v) => v >= 1).map(String),
      steps: [
        {
          label: `${part ? '부서별 ' : ''}순위 계산 결과`,
          sql: `SELECT * FROM (${query(fn, part, dir)}) ORDER BY ${part ? 'DEPTNO, ' : ''}RNK, ENAME`,
        },
      ],
      explain: ({ answerMark, answerText }) =>
        `정답은 ${answerMark}(${answerText})입니다. ${MEANING[fn]}. ${part ? `PARTITION BY DEPTNO가 있으므로 순위는 부서마다 1부터 따로 매겨지고, '${name}'은 자기 부서(${String(target[2])}) 안에서만 비교됩니다.` : '파티션이 없으므로 전체 사원을 한 줄로 세워 순위를 매깁니다.'} ORDER BY SAL ${dir}이므로 급여가 ${dir === 'DESC' ? '큰' : '작은'} 사원이 1위입니다.`,
      examPoint: 'RANK 1,1,3 / DENSE_RANK 1,1,2 / ROW_NUMBER 1,2,3 — PARTITION BY가 있으면 그룹마다 1부터.',
    }
  },
})
