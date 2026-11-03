/**
 * TP03 (S1-05) GROUP BY + HAVING 결과 행 수 — docs/04 §7
 * 변형: WHERE + HAVING COUNT(*) / HAVING COUNT(컬럼) / HAVING SUM
 * 데이터 규칙: 그룹(부서)마다 2행 이상 (docs/04 §7)
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { nearCounts, pickIndexes, salary } from './data'

const STEM = '다음 [EMP] 테이블에 SQL을 실행했을 때 결과 행의 수는?'
const COLUMNS = ['EMPNO', 'DEPTNO', 'SAL', 'COMM']

function makeRows(rng: Rng): CellValue[][] {
  const groups = rng.shuffle([10, 20, 30, 40]).slice(0, rng.int(3, 4))
  const n = rng.int(Math.max(8, groups.length * 2), 11)
  // 앞의 2×그룹 수 만큼은 그룹마다 2행씩, 나머지는 아무 그룹에
  const depts = rng.shuffle([...groups, ...groups, ...Array.from({ length: n - groups.length * 2 }, () => rng.pick(groups))])
  const nullAt = pickIndexes(rng, n, rng.int(2, 4))
  return depts.map((d, i) => [i + 1, d, salary(rng, 1000, 4000), nullAt.has(i) ? null : rng.int(1, 6) * 100])
}

const count = (sql: string) => ({ sql, format: format.count })

function whereHaving(rng: Rng, rows: CellValue[][]): TemplateScenario {
  const y = rng.pick(rows.map((r) => r[2] as number))
  const k = rng.pick([2, 2, 3])
  return {
    tables: [{ name: 'EMP', columns: COLUMNS, rows }],
    stem: STEM,
    sql: `SELECT DEPTNO, COUNT(*) AS CNT\n  FROM EMP\n WHERE SAL >= ${y}\n GROUP BY DEPTNO\nHAVING COUNT(*) >= ${k};`,
    answer: count(`SELECT DEPTNO FROM EMP WHERE SAL >= ${y} GROUP BY DEPTNO HAVING COUNT(*) >= ${k}`),
    traps: [
      { ...count(`SELECT DEPTNO FROM EMP GROUP BY DEPTNO HAVING COUNT(*) >= ${k}`), why: 'WHERE로 행이 먼저 걸러진다는 점을 놓친' },
      { ...count(`SELECT DEPTNO FROM EMP WHERE SAL >= ${y} GROUP BY DEPTNO`), why: 'HAVING 조건을 빠뜨린' },
      { ...count(`SELECT * FROM EMP WHERE SAL >= ${y}`), why: '그룹 수가 아니라 WHERE를 통과한 행 수를 센' },
    ],
    fillers: nearCounts(5),
    steps: [
      // 라벨에 ①②를 쓰지 않는다 — 해설 속 ①~④는 보기 번호로 바뀌기 때문 (docs/04 §4)
      { label: `1단계: WHERE SAL >= ${y} 적용 후`, sql: `SELECT * FROM EMP WHERE SAL >= ${y} ORDER BY DEPTNO, EMPNO` },
      {
        label: '2단계: GROUP BY DEPTNO 집계 (HAVING 적용 전)',
        sql: `SELECT DEPTNO, COUNT(*) AS CNT FROM EMP WHERE SAL >= ${y} GROUP BY DEPTNO ORDER BY DEPTNO`,
      },
    ],
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. SQL은 FROM → WHERE → GROUP BY → HAVING → SELECT 순서로 처리됩니다. 먼저 WHERE가 급여 ${y} 미만인 행을 지우고, 남은 행으로 부서별 그룹을 만든 뒤, HAVING이 그룹 안의 행 수가 ${k}개 이상인 부서만 남깁니다. WHERE는 "행"을, HAVING은 "그룹"을 거른다는 차이가 핵심입니다.`,
    examPoint: 'WHERE는 그룹을 만들기 전 행을, HAVING은 그룹을 만든 뒤 그룹을 거른다.',
  }
}

function countColumn(rng: Rng, rows: CellValue[][]): TemplateScenario {
  const k = rng.pick([1, 2, 2])
  return {
    tables: [{ name: 'EMP', columns: COLUMNS, rows }],
    stem: STEM,
    sql: `SELECT DEPTNO, COUNT(COMM) AS CNT\n  FROM EMP\n GROUP BY DEPTNO\nHAVING COUNT(COMM) >= ${k};`,
    answer: count(`SELECT DEPTNO FROM EMP GROUP BY DEPTNO HAVING COUNT(COMM) >= ${k}`),
    traps: [
      { ...count(`SELECT DEPTNO FROM EMP GROUP BY DEPTNO HAVING COUNT(*) >= ${k}`), why: 'COUNT(COMM)도 COMM이 NULL인 행까지 센다고 본' },
      { ...count('SELECT DEPTNO FROM EMP GROUP BY DEPTNO'), why: 'HAVING 조건을 빠뜨린' },
      { ...count('SELECT * FROM EMP WHERE COMM IS NOT NULL'), why: '그룹 수가 아니라 COMM이 있는 행 수를 센' },
    ],
    fillers: nearCounts(5),
    steps: [
      {
        label: '부서별 COUNT(*)와 COUNT(COMM) (HAVING 적용 전)',
        sql: 'SELECT DEPTNO, COUNT(*) AS "COUNT(*)", COUNT(COMM) AS "COUNT(COMM)" FROM EMP GROUP BY DEPTNO ORDER BY DEPTNO',
      },
    ],
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. COUNT(COMM)은 그룹 안에서 COMM이 NULL이 아닌 행만 셉니다. 그래서 부서의 사원 수(COUNT(*))가 충분해도 COMM이 NULL인 사원이 많으면 COUNT(COMM)은 ${k}보다 작아져 HAVING에서 걸러질 수 있습니다.`,
    examPoint: 'COUNT(*)는 행 수, COUNT(컬럼)은 NULL이 아닌 값의 수 — HAVING에서도 똑같이 적용된다.',
  }
}

function sumHaving(rng: Rng, rows: CellValue[][]): TemplateScenario {
  // 기준값은 실제 부서 합계 중 하나 → 경계에 걸리는 부서가 생긴다
  const sums = new Map<number, number>()
  for (const r of rows) sums.set(r[1] as number, (sums.get(r[1] as number) ?? 0) + (r[2] as number))
  const z = rng.pick([...sums.values()])
  return {
    tables: [{ name: 'EMP', columns: COLUMNS, rows }],
    stem: STEM,
    sql: `SELECT DEPTNO, SUM(SAL) AS TOTAL\n  FROM EMP\n GROUP BY DEPTNO\nHAVING SUM(SAL) >= ${z};`,
    answer: count(`SELECT DEPTNO FROM EMP GROUP BY DEPTNO HAVING SUM(SAL) >= ${z}`),
    traps: [
      { ...count(`SELECT DEPTNO FROM EMP WHERE SAL >= ${z} GROUP BY DEPTNO`), why: 'HAVING 조건을 그룹이 아닌 행마다 적용한(집계 전에 거른)' },
      { ...count('SELECT DEPTNO FROM EMP GROUP BY DEPTNO'), why: 'HAVING 조건을 빠뜨린' },
      { ...count(`SELECT DEPTNO FROM EMP GROUP BY DEPTNO HAVING SUM(SAL) > ${z}`), why: '`>=`의 경계값을 뺀' },
    ],
    fillers: nearCounts(5),
    steps: [
      {
        label: '부서별 SUM(SAL) (HAVING 적용 전)',
        sql: 'SELECT DEPTNO, SUM(SAL) AS TOTAL FROM EMP GROUP BY DEPTNO ORDER BY DEPTNO',
      },
    ],
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. HAVING SUM(SAL) >= ${z}는 부서별로 급여를 모두 더한 "그룹 합계"를 기준값과 비교합니다. 개별 사원의 급여가 ${z}보다 작아도 부서 합계가 ${z} 이상이면 그 부서는 결과에 남습니다.`,
    examPoint: 'HAVING의 집계 조건은 그룹 단위로 계산된 값을 비교한다.',
  }
}

export const TP03 = defineTemplate({
  id: 'TP03',
  subject: 2,
  chapter: 'S1-05',
  topic: 'GROUP BY·HAVING 결과 행 수',
  type: 'sql_result',
  difficulty: 2,
  tags: ['GROUP BY', 'HAVING', 'WHERE', 'COUNT'],
  numericChoices: true,
  build(rng) {
    const rows = makeRows(rng)
    return rng.pick([whereHaving, countColumn, sumHaving])(rng, rows)
  },
})
