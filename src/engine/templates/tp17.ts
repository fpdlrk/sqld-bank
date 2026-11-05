/**
 * TP17 (S2-01) 연관 서브쿼리 결과 건수 — docs/04 §7
 * 변형: 부서 평균보다 많은 급여 / EXISTS로 조건을 만족하는 사원이 있는 부서
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { DEPT_NAMES, nearCounts, pickNames, salary } from './data'

const STEM = '다음 [EMP]와 [DEPT] 테이블에 SQL을 실행했을 때 결과 행의 수는?'
const count = (sql: string) => ({ sql, format: format.count })

interface Data {
  emp: CellValue[][]
  dept: CellValue[][]
}

function makeData(rng: Rng): Data {
  const all = [10, 20, 30, 40]
  const used = rng.shuffle(all).slice(0, rng.int(2, 3))
  const n = rng.int(6, 9)
  // 쓰는 부서마다 2명 이상
  const depts = rng.shuffle([...used, ...used, ...Array.from({ length: n - used.length * 2 }, () => rng.pick(used))])
  const emp: CellValue[][] = pickNames(rng, n).map((name, i) => [i + 1, name, depts[i] ?? 10, salary(rng, 1000, 4000)])
  const dept: CellValue[][] = all.map((d) => [d, DEPT_NAMES[d] ?? 'ETC'])
  return { emp, dept }
}

const tables = (d: Data) => [
  { name: 'EMP', columns: ['EMPNO', 'ENAME', 'DEPTNO', 'SAL'], rows: d.emp },
  { name: 'DEPT', columns: ['DEPTNO', 'DNAME'], rows: d.dept },
]

function aboveAvg(_rng: Rng, d: Data): TemplateScenario {
  const sub = (cond: string) => `SELECT ENAME FROM EMP E WHERE ${cond}`
  return {
    tables: tables(d),
    stem: STEM,
    sql: 'SELECT ENAME\n  FROM EMP E\n WHERE SAL > (SELECT AVG(SAL)\n                FROM EMP X\n               WHERE X.DEPTNO = E.DEPTNO);',
    answer: count(sub('SAL > (SELECT AVG(SAL) FROM EMP X WHERE X.DEPTNO = E.DEPTNO)')),
    traps: [
      { ...count(sub('SAL > (SELECT AVG(SAL) FROM EMP)')), why: '부서별 평균이 아니라 전체 평균과 비교한' },
      { ...count(sub('SAL < (SELECT AVG(SAL) FROM EMP X WHERE X.DEPTNO = E.DEPTNO)')), why: '부등호 방향을 반대로 본' },
      { ...count(sub('SAL >= (SELECT AVG(SAL) FROM EMP X WHERE X.DEPTNO = E.DEPTNO)')), why: '평균과 같은 급여까지 포함한' },
    ],
    fillers: nearCounts(d.emp.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. 서브쿼리 안의 X.DEPTNO = E.DEPTNO가 바깥 행의 부서를 참조하므로, 바깥 사원 한 명마다 "그 사원이 속한 부서의 평균 급여"를 새로 계산해 비교합니다(연관 서브쿼리). 부서별 평균을 먼저 구해 두고, 각 사원의 급여가 자기 부서 평균보다 큰지 확인하면 됩니다.`,
    examPoint: '연관 서브쿼리는 바깥 행마다 다시 실행된다 → "자기 부서 평균"처럼 행마다 다른 기준과 비교.',
  }
}

function exists(rng: Rng, d: Data): TemplateScenario {
  const x = rng.pick(d.emp.map((r) => r[3] as number))
  const sub = (cond: string) => `SELECT DNAME FROM DEPT D WHERE ${cond}`
  const inner = `SELECT 1 FROM EMP E WHERE E.DEPTNO = D.DEPTNO AND E.SAL >= ${x}`
  return {
    tables: tables(d),
    stem: STEM,
    sql: `SELECT DNAME\n  FROM DEPT D\n WHERE EXISTS (SELECT 1\n                 FROM EMP E\n                WHERE E.DEPTNO = D.DEPTNO\n                  AND E.SAL >= ${x});`,
    answer: count(sub(`EXISTS (${inner})`)),
    traps: [
      { ...count(sub(`NOT EXISTS (${inner})`)), why: 'EXISTS를 NOT EXISTS로 본' },
      { ...count(`SELECT * FROM EMP WHERE SAL >= ${x}`), why: '부서가 아니라 조건을 만족하는 사원 수를 센' },
      { text: `${d.dept.length}건`, why: '연관 조건이 없는 EXISTS처럼 모든 부서가 나온다고 본' },
    ],
    fillers: nearCounts(d.dept.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. EXISTS는 서브쿼리 결과가 한 행이라도 있으면 참입니다. 부서마다 "그 부서에 급여 ${x} 이상인 사원이 있는가"를 확인하므로, 그런 사원이 여러 명이어도 부서는 한 번만 나옵니다. 사원이 없는 부서나 조건을 만족하는 사원이 없는 부서는 빠집니다.`,
    examPoint: 'EXISTS = 짝이 하나라도 있으면 참(바깥 행은 한 번만 나옴). 연관 조건이 빠지면 전부 아니면 0.',
  }
}

export const TP17 = defineTemplate({
  id: 'TP17',
  subject: 2,
  chapter: 'S2-01',
  topic: '연관 서브쿼리 결과 건수',
  type: 'sql_result',
  difficulty: 3,
  tags: ['서브쿼리', '연관 서브쿼리', 'EXISTS'],
  numericChoices: true,
  build(rng) {
    return rng.pick([aboveAvg, exists])(rng, makeData(rng))
  },
})
