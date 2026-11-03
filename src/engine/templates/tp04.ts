/**
 * TP04 (S1-08) 조인 종류별 결과 건수 — docs/04 §7
 * 변형: INNER / LEFT / RIGHT / FULL OUTER JOIN / OUTER JOIN의 ON 조건 vs WHERE 조건
 * 데이터 규칙: 짝 없는 행이 양쪽에 1행 이상 (docs/04 §7)
 * SQLite 3.39+ 는 RIGHT·FULL OUTER JOIN을 지원하므로 화면 SQL을 그대로 실행한다.
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { DEPT_NAMES, nearCounts, pickNames, salary } from './data'

type JoinKind = 'INNER JOIN' | 'LEFT OUTER JOIN' | 'RIGHT OUTER JOIN' | 'FULL OUTER JOIN'
const JOINS: JoinKind[] = ['INNER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN']

const WHY: Record<JoinKind, string> = {
  'INNER JOIN': 'INNER JOIN처럼 짝 없는 행을 모두 버린',
  'LEFT OUTER JOIN': 'LEFT OUTER JOIN처럼 왼쪽(EMP)의 짝 없는 행만 살린',
  'RIGHT OUTER JOIN': 'RIGHT OUTER JOIN처럼 오른쪽(DEPT)의 짝 없는 행만 살린',
  'FULL OUTER JOIN': 'FULL OUTER JOIN처럼 양쪽의 짝 없는 행을 모두 살린',
}

const MEANING: Record<JoinKind, string> = {
  'INNER JOIN': '양쪽 테이블에 짝이 있는 행만 남깁니다',
  'LEFT OUTER JOIN': '짝이 있는 행에 더해, 왼쪽 테이블(EMP)에서 짝이 없는 행도 오른쪽 컬럼을 NULL로 채워 남깁니다',
  'RIGHT OUTER JOIN': '짝이 있는 행에 더해, 오른쪽 테이블(DEPT)에서 짝이 없는 행도 왼쪽 컬럼을 NULL로 채워 남깁니다',
  'FULL OUTER JOIN': '짝이 있는 행에 더해, 양쪽 테이블에서 짝이 없는 행을 모두 남깁니다',
}

interface Data {
  dept: CellValue[][]
  emp: CellValue[][]
}

function makeData(rng: Rng): Data {
  const deptNos = rng.shuffle([10, 20, 30, 40, 50]).slice(0, rng.int(3, 4)).sort((a, b) => a - b)
  const empty = rng.pick(deptNos) // 사원이 없는 부서 (DEPT 쪽 짝 없음)
  const used = deptNos.filter((d) => d !== empty)
  const orphans = rng.int(1, 2) // 부서가 없는 사원 (EMP 쪽 짝 없음)
  const n = rng.int(5, 8)
  const names = pickNames(rng, n)
  const emp = names.map((name, i): CellValue[] => {
    const deptno = i < orphans ? rng.pick([null, 60, 70]) : rng.pick(used)
    return [i + 1, name, deptno, salary(rng, 1000, 4000)]
  })
  // 짝 없는 사원이 앞에 몰리지 않게 섞은 뒤 사번을 다시 매긴다
  const shuffled = rng.shuffle(emp).map((r, i) => [i + 1, ...r.slice(1)])
  return { dept: deptNos.map((d) => [d, DEPT_NAMES[d] ?? 'ETC']), emp: shuffled }
}

const tables = (d: Data) => [
  { name: 'EMP', columns: ['EMPNO', 'ENAME', 'DEPTNO', 'SAL'], rows: d.emp },
  { name: 'DEPT', columns: ['DEPTNO', 'DNAME'], rows: d.dept },
]
const STEM = '다음 [EMP], [DEPT] 테이블에 SQL을 실행했을 때 결과 행의 수는?'
const joinSql = (kind: JoinKind) => `SELECT E.EMPNO, E.ENAME, D.DNAME FROM EMP E ${kind} DEPT D ON E.DEPTNO = D.DEPTNO`

function joinKind(rng: Rng, d: Data): TemplateScenario {
  const kind = rng.pick(JOINS)
  return {
    tables: tables(d),
    stem: STEM,
    sql: `SELECT E.EMPNO, E.ENAME, D.DNAME\n  FROM EMP E\n  ${kind} DEPT D\n    ON E.DEPTNO = D.DEPTNO;`,
    answer: { sql: joinSql(kind), format: format.count },
    traps: JOINS.filter((k) => k !== kind).map((k) => ({ sql: joinSql(k), format: format.count, why: WHY[k] })),
    fillers: nearCounts(d.emp.length + d.dept.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. ${kind}은 ${MEANING[kind]}. EMP의 DEPTNO가 NULL이거나 DEPT에 없는 번호인 사원은 짝이 없고, 사원이 한 명도 없는 부서도 짝이 없습니다. 짝 있는 행 수에 어느 쪽의 짝 없는 행이 더해지는지 세어 보세요.`,
    examPoint: 'INNER = 짝 있는 행만 / LEFT·RIGHT = 한쪽의 짝 없는 행 추가 / FULL = 양쪽 모두 추가.',
  }
}

function onVsWhere(rng: Rng, d: Data): TemplateScenario {
  const x = rng.pick(d.emp.map((r) => r[3] as number))
  const base = 'SELECT D.DEPTNO, E.EMPNO FROM DEPT D LEFT OUTER JOIN EMP E ON D.DEPTNO = E.DEPTNO'
  return {
    tables: tables(d),
    stem: STEM,
    sql: `SELECT D.DEPTNO, E.EMPNO\n  FROM DEPT D\n  LEFT OUTER JOIN EMP E\n    ON D.DEPTNO = E.DEPTNO\n   AND E.SAL >= ${x};`,
    answer: { sql: `${base} AND E.SAL >= ${x}`, format: format.count },
    traps: [
      { sql: `${base} WHERE E.SAL >= ${x}`, format: format.count, why: 'ON의 추가 조건을 WHERE처럼 적용해 짝 없는 부서까지 걸러 낸' },
      { sql: base, format: format.count, why: 'ON의 SAL 조건을 무시한' },
      {
        sql: `SELECT D.DEPTNO, E.EMPNO FROM DEPT D JOIN EMP E ON D.DEPTNO = E.DEPTNO AND E.SAL >= ${x}`,
        format: format.count,
        why: 'OUTER JOIN인데도 조건에 맞는 사원이 없는 부서가 사라진다고 본',
      },
    ],
    fillers: nearCounts(d.emp.length + d.dept.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. LEFT OUTER JOIN에서 ON 절의 조건은 "어떤 사원을 짝으로 붙일지"만 정합니다. 급여가 ${x} 미만인 사원은 짝으로 붙지 않을 뿐이고, DEPT의 모든 부서는 짝이 없더라도 EMPNO를 NULL로 채운 한 행으로 반드시 남습니다. 같은 조건을 WHERE에 쓰면 조인이 끝난 뒤 E.SAL이 NULL인 행까지 걸러져 결과가 달라집니다.`,
    examPoint: 'OUTER JOIN의 추가 조건은 ON에 쓰면 짝 고르기, WHERE에 쓰면 조인 후 행 거르기.',
  }
}

export const TP04 = defineTemplate({
  id: 'TP04',
  subject: 2,
  chapter: 'S1-08',
  topic: '조인 종류별 결과 건수',
  type: 'sql_result',
  difficulty: 2,
  tags: ['JOIN', 'OUTER JOIN', 'ON', 'WHERE'],
  numericChoices: true,
  build(rng) {
    const d = makeData(rng)
    return rng.pick([joinKind, joinKind, onVsWhere])(rng, d)
  },
})
