/**
 * TP12 (S1-03) CASE 등급 결과 건수 — docs/04 §7
 * 변형: WHEN 순서(먼저 만족한 WHEN만 적용) / ELSE가 없으면 NULL
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { nearCounts, pickNames, salary } from './data'

const STEM = '다음 [EMP] 테이블에 SQL을 실행했을 때 결과 행의 수는?'
const count = (where: string) => ({ sql: `SELECT * FROM EMP WHERE ${where}`, format: format.count })

interface Emp {
  rows: CellValue[][]
  /** 서로 다른 급여, 오름차순 */
  sals: number[]
}

/** 실제 데이터에 있는 급여 두 개를 경계로 고른다 (lo < hi) */
function bounds(rng: Rng, emp: Emp): [number, number] {
  const s = emp.sals
  const i = rng.int(1, Math.max(1, s.length - 3))
  const j = rng.int(i + 1, Math.max(i + 1, s.length - 1))
  return [s[i] ?? 1500, s[j] ?? 3000]
}

function gradeB(rng: Rng, emp: Emp): TemplateScenario {
  const [lo, hi] = bounds(rng, emp)
  const caseExpr = `CASE WHEN SAL >= ${hi} THEN 'A'\n                    WHEN SAL >= ${lo} THEN 'B'\n                    ELSE 'C' END`
  return {
    tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'SAL'], rows: emp.rows }],
    stem: STEM,
    sql: `SELECT ENAME\n  FROM (SELECT ENAME,\n               ${caseExpr} AS GRADE\n          FROM EMP)\n WHERE GRADE = 'B';`,
    answer: count(`SAL >= ${lo} AND SAL < ${hi}`),
    traps: [
      { ...count(`SAL >= ${lo}`), why: "앞의 WHEN에서 이미 'A'로 정해진 행까지 'B'로 센" },
      { ...count(`SAL > ${lo} AND SAL < ${hi}`), why: `급여가 정확히 ${lo}인 행을 빼고 센` },
      { ...count(`SAL < ${hi}`), why: "ELSE로 가는 행까지 'B'로 센" },
    ],
    fillers: nearCounts(emp.rows.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. CASE는 WHEN을 위에서부터 차례로 검사하다가 처음 만족한 WHEN의 값만 돌려줍니다. 급여가 ${hi} 이상인 행은 첫 WHEN에서 이미 'A'가 되므로 두 번째 WHEN까지 내려가지 않습니다. 따라서 'B'는 ${lo} 이상 ${hi} 미만인 행이고, 경계값 ${lo}은 >= 조건이라 포함됩니다.`,
    examPoint: 'CASE는 처음 만족한 WHEN 하나만 적용 → 범위 조건은 큰 값부터 순서대로 쓴다.',
  }
}

function noElse(rng: Rng, emp: Emp): TemplateScenario {
  const [lo, hi] = bounds(rng, emp)
  const caseExpr = `CASE WHEN SAL >= ${hi} THEN 'HIGH'\n                    WHEN SAL >= ${lo} THEN 'MID' END`
  return {
    tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'SAL'], rows: emp.rows }],
    stem: STEM,
    sql: `SELECT ENAME\n  FROM (SELECT ENAME,\n               ${caseExpr} AS GRADE\n          FROM EMP)\n WHERE GRADE IS NULL;`,
    answer: count(`SAL < ${lo}`),
    traps: [
      { text: '0건', why: 'ELSE가 없어도 NULL이 아닌 값이 들어간다고 본' },
      { ...count(`SAL <= ${lo}`), why: `경계값 ${lo}도 어느 WHEN에도 해당하지 않는다고 본` },
      { ...count(`SAL < ${hi}`), why: "'MID' 행까지 NULL로 본" },
    ],
    fillers: nearCounts(emp.rows.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. CASE에 ELSE를 쓰지 않으면, 어느 WHEN도 만족하지 않는 행의 결과는 NULL이 됩니다. 급여가 ${lo} 미만인 행은 두 WHEN을 모두 통과하지 못하므로 GRADE가 NULL이고, 바깥 쿼리의 GRADE IS NULL 조건에 걸립니다. 기본값이 필요하면 ELSE를 꼭 써야 합니다.`,
    examPoint: 'CASE에 ELSE가 없으면 어느 WHEN에도 맞지 않는 행은 NULL.',
  }
}

export const TP12 = defineTemplate({
  id: 'TP12',
  subject: 2,
  chapter: 'S1-03',
  topic: 'CASE 등급 결과 건수',
  type: 'sql_result',
  difficulty: 2,
  tags: ['CASE', 'NULL'],
  numericChoices: true,
  build(rng) {
    const n = rng.int(7, 10)
    const rows: CellValue[][] = pickNames(rng, n).map((name, i) => [i + 1, name, salary(rng, 1000, 4000)])
    const sals = [...new Set(rows.map((r) => r[2] as number))].sort((a, b) => a - b)
    return rng.pick([gradeB, noElse])(rng, { rows, sals })
  },
})
