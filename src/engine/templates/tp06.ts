/**
 * TP06 (S2-01) IN / NOT IN / EXISTS 서브쿼리 결과 건수 — docs/04 §7
 * 변형: NOT IN + NULL / NOT EXISTS / IN과 NULL·없는 부서 번호
 * SQLite도 표준대로 "x NOT IN (… NULL …)"을 UNKNOWN으로 처리하므로 화면 SQL을 그대로 실행한다.
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { DEPT_NAMES, nearCounts, pickNames, salary } from './data'

interface Data {
  dept: CellValue[][]
  emp: CellValue[][]
}

/** nulls: DEPTNO가 NULL인 사원 수, orphans: DEPT에 없는 번호(60)를 가진 사원 수 */
function makeData(rng: Rng, nulls: number, orphans: number): Data {
  const deptNos = rng.shuffle([10, 20, 30, 40, 50]).slice(0, 4).sort((a, b) => a - b)
  const used = rng.shuffle(deptNos).slice(0, rng.int(2, 3)) // 나머지 부서는 사원이 없음
  const n = rng.int(6, 8)
  const names = pickNames(rng, n)
  const special: CellValue[] = [...Array<CellValue>(nulls).fill(null), ...Array<CellValue>(orphans).fill(60)]
  const emp = rng.shuffle(names.map((name, i) => [name, i < special.length ? special[i] ?? null : rng.pick(used)]))
  return {
    dept: deptNos.map((d) => [d, DEPT_NAMES[d] ?? 'ETC']),
    emp: emp.map(([name, d], i) => [i + 1, name ?? '', d ?? null, salary(rng, 1000, 3000)]),
  }
}

const tables = (d: Data) => [
  { name: 'EMP', columns: ['EMPNO', 'ENAME', 'DEPTNO', 'SAL'], rows: d.emp },
  { name: 'DEPT', columns: ['DEPTNO', 'DNAME'], rows: d.dept },
]
const STEM = '다음 [EMP], [DEPT] 테이블에 SQL을 실행했을 때 결과 행의 수는?'
const count = (sql: string) => ({ sql, format: format.count })

function notIn(rng: Rng): TemplateScenario {
  const hasNull = rng.chance(0.7)
  const d = makeData(rng, hasNull ? rng.int(1, 2) : 0, 0)
  const notExists = 'SELECT * FROM DEPT D WHERE NOT EXISTS (SELECT 1 FROM EMP E WHERE E.DEPTNO = D.DEPTNO)'
  return {
    tables: tables(d),
    stem: STEM,
    sql: 'SELECT *\n  FROM DEPT\n WHERE DEPTNO NOT IN (SELECT DEPTNO FROM EMP);',
    answer: count('SELECT * FROM DEPT WHERE DEPTNO NOT IN (SELECT DEPTNO FROM EMP)'),
    traps: [
      hasNull
        ? { ...count(notExists), why: '서브쿼리 결과에 섞인 NULL을 무시하고 사원 없는 부서를 센' }
        : { text: '0건', why: '서브쿼리에 NULL이 없는데도 NOT IN 결과가 0건이 된다고 본' },
      { ...count('SELECT * FROM DEPT WHERE DEPTNO IN (SELECT DEPTNO FROM EMP)'), why: 'IN과 혼동해 사원이 있는 부서를 센' },
      { ...count('SELECT * FROM DEPT'), why: 'NOT IN 조건이 아무것도 거르지 않는다고 본' },
    ],
    fillers: nearCounts(d.dept.length),
    explain: ({ answerMark, answerText }) =>
      hasNull
        ? `정답은 ${answerMark}(${answerText})입니다. 서브쿼리 결과에 NULL이 하나라도 있으면 \`DEPTNO NOT IN (…, NULL)\`은 \`DEPTNO <> … AND DEPTNO <> NULL\`이 되는데, NULL과의 비교는 항상 UNKNOWN이라 어떤 행도 TRUE가 되지 못합니다. 그래서 사원이 없는 부서가 있더라도 결과는 0건입니다. 사원이 없는 부서를 찾으려면 NOT EXISTS를 쓰거나 서브쿼리에 \`WHERE DEPTNO IS NOT NULL\`을 붙여야 합니다.`
        : `정답은 ${answerMark}(${answerText})입니다. 이번 데이터에서는 EMP.DEPTNO에 NULL이 없으므로 NOT IN이 정상적으로 동작해, 서브쿼리 결과(사원이 있는 부서 번호)에 들어 있지 않은 부서만 남습니다. 서브쿼리에 NULL이 섞여 있었다면 결과는 0건이 되었을 것입니다.`,
    examPoint: 'NOT IN 서브쿼리 결과에 NULL이 하나라도 있으면 결과는 0건 — NOT EXISTS는 NULL의 영향을 받지 않는다.',
  }
}

function notExists(rng: Rng): TemplateScenario {
  const d = makeData(rng, rng.int(1, 2), 0)
  const sql = 'SELECT * FROM DEPT D WHERE NOT EXISTS (SELECT 1 FROM EMP E WHERE E.DEPTNO = D.DEPTNO)'
  return {
    tables: tables(d),
    stem: STEM,
    sql: 'SELECT *\n  FROM DEPT D\n WHERE NOT EXISTS (SELECT 1\n                     FROM EMP E\n                    WHERE E.DEPTNO = D.DEPTNO);',
    answer: count(sql),
    traps: [
      { text: '0건', why: 'NOT IN처럼 EMP.DEPTNO의 NULL 때문에 0건이 된다고 본' },
      { ...count('SELECT * FROM DEPT D WHERE EXISTS (SELECT 1 FROM EMP E WHERE E.DEPTNO = D.DEPTNO)'), why: 'EXISTS와 반대로 사원이 있는 부서를 센' },
      { ...count('SELECT * FROM DEPT'), why: 'NOT EXISTS 조건이 아무것도 거르지 않는다고 본' },
    ],
    fillers: nearCounts(d.dept.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. NOT EXISTS는 부서마다 서브쿼리를 실행해 "그 부서 번호와 같은 사원이 한 명이라도 있는지"만 봅니다. DEPTNO가 NULL인 사원은 어떤 부서와도 같지 않을 뿐, NOT IN처럼 결과 전체를 0건으로 만들지는 않습니다. 따라서 사원이 한 명도 없는 부서만 결과에 남습니다.`,
    examPoint: 'NOT EXISTS는 서브쿼리에 NULL이 있어도 안전하다 — NOT IN과의 가장 큰 차이.',
  }
}

function inNull(rng: Rng): TemplateScenario {
  const d = makeData(rng, rng.int(1, 2), 1)
  return {
    tables: tables(d),
    stem: STEM,
    sql: 'SELECT *\n  FROM EMP\n WHERE DEPTNO IN (SELECT DEPTNO FROM DEPT);',
    answer: count('SELECT * FROM EMP WHERE DEPTNO IN (SELECT DEPTNO FROM DEPT)'),
    traps: [
      {
        ...count('SELECT * FROM EMP WHERE DEPTNO IN (SELECT DEPTNO FROM DEPT) OR DEPTNO IS NULL'),
        why: 'DEPTNO가 NULL인 사원도 IN으로 찾을 수 있다고 본',
      },
      { ...count('SELECT * FROM EMP'), why: 'DEPT에 없는 부서 번호와 NULL도 결과에 포함한다고 본' },
      { ...count('SELECT * FROM EMP WHERE DEPTNO NOT IN (SELECT DEPTNO FROM DEPT)'), why: 'NOT IN과 혼동한' },
    ],
    fillers: nearCounts(d.emp.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. IN은 DEPTNO가 서브쿼리 결과(DEPT의 부서 번호) 중 하나와 같은 사원만 남깁니다. DEPT에 없는 번호(60)를 가진 사원은 같은 값이 없어서 빠지고, DEPTNO가 NULL인 사원은 NULL과의 비교가 UNKNOWN이라 역시 빠집니다.`,
    examPoint: 'IN·= 비교로는 NULL을 찾을 수 없다 — NULL은 IS NULL로만 찾는다.',
  }
}

export const TP06 = defineTemplate({
  id: 'TP06',
  subject: 2,
  chapter: 'S2-01',
  topic: 'IN·NOT IN·EXISTS와 NULL',
  type: 'sql_result',
  difficulty: 3,
  tags: ['서브쿼리', 'NOT IN', 'EXISTS', 'NULL'],
  numericChoices: true,
  build(rng) {
    return rng.pick([notIn, notIn, notExists, inNull])(rng)
  },
})
