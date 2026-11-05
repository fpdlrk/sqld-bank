/**
 * TP15 (S2-03) ROLLUP·CUBE·GROUPING SETS 결과 행 수 — docs/04 §7
 * 변형: ROLLUP(DEPTNO, JOB) / CUBE(DEPTNO, JOB) / GROUPING SETS(DEPTNO, JOB)
 *
 * SQLite에는 ROLLUP 등이 없으므로 실행용 SQL은 UNION ALL 조합으로 만든다 (docs/04 §6).
 * 화면 SQL은 Oracle 문법 그대로 보여 준다 → tests/templates.test.ts가 JS 계산으로 따로 대조한다.
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { nearCounts, salary } from './data'

const JOBS = ['CLERK', 'MANAGER', 'ANALYST', 'SALESMAN']

/** 그룹 행 종류별 SELECT — 소계·총계 자리는 NULL (모두 별칭을 붙여 어느 것이 먼저 와도 컬럼 이름이 같다) */
const PART = {
  both: 'SELECT DEPTNO, JOB, SUM(SAL) AS TOTAL FROM EMP GROUP BY DEPTNO, JOB',
  dept: 'SELECT DEPTNO, NULL AS JOB, SUM(SAL) AS TOTAL FROM EMP GROUP BY DEPTNO',
  job: 'SELECT NULL AS DEPTNO, JOB, SUM(SAL) AS TOTAL FROM EMP GROUP BY JOB',
  total: 'SELECT NULL AS DEPTNO, NULL AS JOB, SUM(SAL) AS TOTAL FROM EMP',
}
type Part = keyof typeof PART

const rows = (parts: Part[]) => ({ sql: parts.map((p) => PART[p]).join(' UNION ALL '), format: format.count })

const ROLLUP: Part[] = ['both', 'dept', 'total']
const CUBE: Part[] = ['both', 'dept', 'job', 'total']
const SETS: Part[] = ['dept', 'job']

type Kind = 'ROLLUP' | 'CUBE' | 'SETS'

const VARIANTS: Record<Kind, { clause: string; parts: Part[]; traps: TemplateScenario['traps']; story: string }> = {
  ROLLUP: {
    clause: 'ROLLUP(DEPTNO, JOB)',
    parts: ROLLUP,
    traps: [
      { ...rows(['both']), why: '소계·총계 행을 빼고 (DEPTNO, JOB) 그룹만 센' },
      { ...rows(CUBE), why: 'ROLLUP을 CUBE처럼 JOB별 소계까지 센' },
      { ...rows(['both', 'dept']), why: '마지막 총계 행을 빠뜨린' },
    ],
    story:
      'ROLLUP(DEPTNO, JOB)은 오른쪽 컬럼부터 하나씩 빼며 (DEPTNO, JOB) → (DEPTNO) → () 세 단계로 묶습니다. 그래서 결과는 "부서·업무 조합 수 + 부서 수 + 총계 1행"입니다.',
  },
  CUBE: {
    clause: 'CUBE(DEPTNO, JOB)',
    parts: CUBE,
    traps: [
      { ...rows(ROLLUP), why: 'CUBE를 ROLLUP처럼 부서별 소계만 센' },
      { ...rows(['both']), why: '소계·총계 행을 빼고 (DEPTNO, JOB) 그룹만 센' },
      { ...rows(['both', 'dept', 'job']), why: '마지막 총계 행을 빠뜨린' },
    ],
    story:
      'CUBE(DEPTNO, JOB)은 가능한 모든 조합 (DEPTNO, JOB), (DEPTNO), (JOB), ()로 묶습니다. 그래서 결과는 "부서·업무 조합 수 + 부서 수 + 업무 수 + 총계 1행"입니다.',
  },
  SETS: {
    clause: 'GROUPING SETS(DEPTNO, JOB)',
    parts: SETS,
    traps: [
      { ...rows(['both']), why: 'GROUPING SETS를 두 컬럼 GROUP BY로 본' },
      { ...rows(['dept', 'job', 'total']), why: '총계 행이 함께 나온다고 본' },
      { ...rows(CUBE), why: 'GROUPING SETS를 CUBE처럼 모든 조합으로 본' },
    ],
    story:
      'GROUPING SETS(DEPTNO, JOB)은 괄호 안에 적은 기준마다 따로 GROUP BY한 결과를 이어 붙입니다. (DEPTNO)별 행과 (JOB)별 행만 나오고, 두 컬럼 조합이나 총계 행은 적지 않았으므로 나오지 않습니다.',
  },
}

export const TP15 = defineTemplate({
  id: 'TP15',
  subject: 2,
  chapter: 'S2-03',
  topic: 'ROLLUP·CUBE 결과 행 수',
  type: 'sql_result',
  difficulty: 3,
  tags: ['그룹 함수', 'ROLLUP', 'CUBE', 'GROUPING SETS'],
  numericChoices: true,
  build(rng: Rng): TemplateScenario {
    const depts = rng.shuffle([10, 20, 30]).slice(0, rng.int(2, 3))
    const jobs = rng.shuffle(JOBS).slice(0, rng.int(2, 3))
    const n = rng.int(6, 10)
    const emp: CellValue[][] = Array.from({ length: n }, (_, i) => [i + 1, rng.pick(depts), rng.pick(jobs), salary(rng, 1000, 3000)])
    const kind = rng.pick(['ROLLUP', 'CUBE', 'SETS'] as const)
    const v = VARIANTS[kind]
    return {
      tables: [{ name: 'EMP', columns: ['EMPNO', 'DEPTNO', 'JOB', 'SAL'], rows: emp }],
      stem: '다음 [EMP] 테이블에 Oracle에서 SQL을 실행했을 때 결과 행의 수는?',
      sql: `SELECT DEPTNO, JOB, SUM(SAL) AS TOTAL\n  FROM EMP\n GROUP BY ${v.clause};`,
      answer: rows(v.parts),
      traps: v.traps,
      fillers: nearCounts(30),
      explain: ({ answerMark, answerText }) =>
        `정답은 ${answerMark}(${answerText})입니다. ${v.story} 아래 결과에서 DEPTNO나 JOB이 NULL인 행이 소계·총계 행입니다.`,
      examPoint: 'ROLLUP(a,b) = (a,b)+(a)+(), CUBE(a,b) = (a,b)+(a)+(b)+(), GROUPING SETS(a,b) = (a)+(b).',
    }
  },
})
