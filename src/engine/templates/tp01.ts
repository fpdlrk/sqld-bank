/**
 * TP01 (S1-04) WHERE 조건 결과 건수 — docs/04 §7
 * 변형: AND/OR 우선순위 / BETWEEN 경계 / LIKE의 _
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { nearCounts, pickNames, salary } from './data'

interface Emp {
  rows: CellValue[][]
  sals: number[]
}

function makeEmp(rng: Rng): Emp {
  const n = rng.int(7, 10)
  const names = pickNames(rng, n)
  const sals = names.map(() => salary(rng, 800, 4000))
  const rows = names.map((name, i) => [i + 1, name, rng.pick([10, 20, 30]), sals[i] ?? 0])
  return { rows, sals }
}

const STEM = '다음 [EMP] 테이블에 SQL을 실행했을 때 결과 행의 수는?'
const count = (where: string) => ({ sql: `SELECT * FROM EMP WHERE ${where}`, format: format.count })

function precedence(rng: Rng, emp: Emp): TemplateScenario {
  const [a, b] = rng.shuffle([10, 20, 30]) as [number, number]
  const x = rng.pick(emp.sals)
  const where = `DEPTNO = ${a} OR DEPTNO = ${b} AND SAL >= ${x}`
  return {
    tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'DEPTNO', 'SAL'], rows: emp.rows }],
    stem: STEM,
    sql: `SELECT *\n  FROM EMP\n WHERE ${where};`,
    answer: count(where),
    traps: [
      { ...count(`(DEPTNO = ${a} OR DEPTNO = ${b}) AND SAL >= ${x}`), why: 'AND보다 OR을 먼저 계산한' },
      { ...count(`DEPTNO = ${a} OR DEPTNO = ${b}`), why: 'SAL 조건을 무시한' },
      { ...count(`DEPTNO = ${b} AND SAL >= ${x}`), why: 'OR 앞의 조건을 빠뜨린' },
    ],
    fillers: nearCounts(emp.rows.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. AND가 OR보다 먼저 계산되므로 조건은 \`DEPTNO = ${a} OR (DEPTNO = ${b} AND SAL >= ${x})\`로 묶입니다. 즉 ${a}번 부서 사원은 급여와 상관없이 모두 남고, ${b}번 부서 사원은 급여가 ${x} 이상인 경우에만 남습니다. 의도가 "두 부서 중 급여 ${x} 이상"이었다면 OR 부분을 괄호로 묶어야 합니다.`,
    examPoint: '논리 연산자 우선순위는 NOT > AND > OR — 괄호가 없으면 AND부터 묶인다.',
  }
}

function between(rng: Rng, emp: Emp): TemplateScenario {
  const distinct = [...new Set(emp.sals)].sort((p, q) => p - q)
  // 양 끝 값이 실제 데이터에 있어야 "경계 포함" 함정이 드러난다
  const i = rng.int(0, Math.max(0, distinct.length - 3))
  const x = distinct[i] ?? 1000
  const y = distinct[Math.min(distinct.length - 1, i + rng.int(2, 4))] ?? 3000
  const where = `SAL BETWEEN ${x} AND ${y}`
  return {
    tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'DEPTNO', 'SAL'], rows: emp.rows }],
    stem: STEM,
    sql: `SELECT *\n  FROM EMP\n WHERE ${where};`,
    answer: count(where),
    traps: [
      { ...count(`SAL > ${x} AND SAL < ${y}`), why: 'BETWEEN이 양 끝 값을 포함한다는 점을 놓친' },
      { ...count(`SAL >= ${x} AND SAL < ${y}`), why: '끝 값만 범위에서 뺀' },
      { ...count(`SAL > ${x} AND SAL <= ${y}`), why: '시작 값만 범위에서 뺀' },
    ],
    fillers: nearCounts(emp.rows.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. \`SAL BETWEEN ${x} AND ${y}\` 조건은 \`SAL >= ${x} AND SAL <= ${y}\`와 같아서 양 끝 값 ${x}과 ${y}도 범위에 들어갑니다. 급여가 정확히 ${x}이거나 ${y}인 사원도 결과에 포함되는지 확인하세요.`,
    examPoint: 'BETWEEN a AND b는 a와 b를 모두 포함한다 (a ≤ 값 ≤ b). 작은 값을 앞에 써야 한다.',
  }
}

function like(rng: Rng, emp: Emp): TemplateScenario {
  const c = rng.pick(['A', 'O', 'I', 'E'])
  return {
    tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'DEPTNO', 'SAL'], rows: emp.rows }],
    stem: STEM,
    sql: `SELECT *\n  FROM EMP\n WHERE ENAME LIKE '_${c}%';`,
    answer: count(`ENAME LIKE '_${c}%'`),
    traps: [
      { ...count(`ENAME LIKE '%${c}%'`), why: '`_`를 `%`처럼 "몇 글자든"으로 본' },
      { ...count(`ENAME LIKE '${c}%'`), why: '`_`를 무시하고 첫 글자가 ' + c + '인 이름을 센' },
      { ...count(`ENAME LIKE '_${c}'`), why: '뒤의 `%`를 빠뜨려 정확히 두 글자인 이름만 센' },
    ],
    fillers: nearCounts(emp.rows.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. LIKE에서 \`_\`는 "정확히 한 글자", \`%\`는 "0글자 이상"을 뜻합니다. 따라서 \`'_${c}%'\`는 **두 번째 글자가 ${c}**인 이름(길이는 2글자 이상 아무거나)과 일치합니다. 이름의 두 번째 글자만 차례로 확인해 보세요.`,
    examPoint: "LIKE의 _는 한 글자, %는 0글자 이상 — '_A%'는 두 번째 글자가 A인 문자열.",
  }
}

export const TP01 = defineTemplate({
  id: 'TP01',
  subject: 2,
  chapter: 'S1-04',
  topic: 'WHERE 조건 결과 건수',
  type: 'sql_result',
  difficulty: 2,
  tags: ['WHERE', '연산자 우선순위', 'BETWEEN', 'LIKE'],
  numericChoices: true,
  build(rng) {
    const emp = makeEmp(rng)
    return rng.pick([precedence, between, like])(rng, emp)
  },
})
