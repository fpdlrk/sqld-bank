/**
 * TP14 (S1-07) NON-EQUI 조인 결과 건수 — docs/04 §7
 * 변형: 등급 범위 밖의 사원이 있는 조인 / 특정 등급의 사원 수
 * 데이터 규칙: 급여 하나는 반드시 등급 경계값과 같게 만든다 (BETWEEN 경계 함정이 드러나도록)
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { nearCounts, pickNames, salary } from './data'

const STEM = '다음 [EMP]와 [SALGRADE] 테이블에 SQL을 실행했을 때 결과 행의 수는?'
const FROM = 'FROM EMP E, SALGRADE S'
const count = (where: string) => ({ sql: `SELECT E.ENAME, S.GRADE ${FROM}${where ? ` WHERE ${where}` : ''}`, format: format.count })
const BETWEEN = 'E.SAL BETWEEN S.LOSAL AND S.HISAL'

interface Data {
  emp: CellValue[][]
  grades: CellValue[][]
}

function makeData(rng: Rng): Data {
  // 등급: 이어진 범위 3~4개, 맨 아래나 맨 위에 빈 구간이 생길 수 있다
  const k = rng.int(3, 4)
  let lo = rng.int(7, 12) * 100
  const grades: CellValue[][] = []
  for (let g = 1; g <= k; g++) {
    const hi = lo + rng.int(4, 9) * 100
    grades.push([g, lo, hi])
    lo = hi + 100
  }
  const n = rng.int(6, 9)
  const emp: CellValue[][] = pickNames(rng, n).map((name, i) => [i + 1, name, salary(rng, 600, 4500)])
  // 한 명은 경계값(LOSAL 또는 HISAL)과 같은 급여
  const edge = rng.pick(grades)
  const who = rng.pick(emp)
  who[2] = edge[rng.pick([1, 2])] ?? 1000
  return { emp, grades }
}

function tables(d: Data) {
  return [
    { name: 'EMP', columns: ['EMPNO', 'ENAME', 'SAL'], rows: d.emp },
    { name: 'SALGRADE', columns: ['GRADE', 'LOSAL', 'HISAL'], rows: d.grades },
  ]
}

function allGrades(_rng: Rng, d: Data): TemplateScenario {
  return {
    tables: tables(d),
    stem: STEM,
    sql: `SELECT E.ENAME, S.GRADE\n  ${FROM}\n WHERE ${BETWEEN};`,
    answer: count(BETWEEN),
    traps: [
      { text: `${d.emp.length}건`, why: '등급 범위 밖의 사원도 결과에 나온다고 본' },
      { ...count('E.SAL > S.LOSAL AND E.SAL < S.HISAL'), why: 'BETWEEN이 경계값을 포함한다는 점을 놓친' },
      { ...count(''), why: '조인 조건 없이 모든 조합을 센' },
    ],
    fillers: nearCounts(d.emp.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. 이 조인은 = 대신 BETWEEN으로 연결하는 비등가(NON-EQUI) 조인입니다. 사원마다 자신의 급여가 LOSAL 이상 HISAL 이하인 등급 행과 짝이 지어지며, 경계값과 같은 급여도 BETWEEN에 포함됩니다. 어느 등급 범위에도 들지 않는 급여의 사원은 짝이 없어 내부 조인 결과에서 빠집니다.`,
    examPoint: 'NON-EQUI 조인: E.SAL BETWEEN S.LOSAL AND S.HISAL (경계 포함). 범위 밖 사원은 내부 조인에서 빠진다.',
  }
}

function oneGrade(rng: Rng, d: Data): TemplateScenario {
  const g = rng.pick(d.grades)[0] as number
  const and = ` AND S.GRADE = ${g}`
  return {
    tables: tables(d),
    stem: STEM,
    sql: `SELECT E.ENAME, S.GRADE\n  ${FROM}\n WHERE ${BETWEEN}\n   AND S.GRADE = ${g};`,
    answer: count(BETWEEN + and),
    traps: [
      { ...count(`E.SAL > S.LOSAL AND E.SAL < S.HISAL${and}`), why: 'BETWEEN이 경계값을 포함한다는 점을 놓친' },
      { ...count(`E.SAL >= S.LOSAL${and}`), why: 'HISAL 조건을 빠뜨린' },
      { ...count(`E.SAL <= S.HISAL${and}`), why: 'LOSAL 조건을 빠뜨린' },
    ],
    fillers: nearCounts(d.emp.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. ${g}등급 행의 범위(LOSAL 이상 HISAL 이하)에 급여가 들어가는 사원만 짝이 지어집니다. BETWEEN은 양 끝 값을 포함하므로 급여가 LOSAL이나 HISAL과 정확히 같은 사원도 결과에 들어갑니다. 등급 표에서 ${g}등급의 범위를 먼저 확인한 뒤 사원 급여를 하나씩 대조해 보세요.`,
    examPoint: 'BETWEEN a AND b = a 이상 b 이하. 범위 조인에서 LOSAL·HISAL 두 조건이 모두 필요하다.',
  }
}

export const TP14 = defineTemplate({
  id: 'TP14',
  subject: 2,
  chapter: 'S1-07',
  topic: 'NON-EQUI 조인 결과 건수',
  type: 'sql_result',
  difficulty: 2,
  tags: ['조인', 'NON-EQUI 조인', 'BETWEEN'],
  numericChoices: true,
  build(rng) {
    return rng.pick([allGrades, oneGrade])(rng, makeData(rng))
  },
})
