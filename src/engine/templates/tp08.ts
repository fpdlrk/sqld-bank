/**
 * TP08 (S2-04) 집계 윈도우 함수(SUM OVER) — 특정 행의 값 (docs/04 §7)
 * 변형: ORDER BY 누적에서 같은 값(동순위) 처리 / PARTITION BY 누적
 *
 * ORDER BY가 있는 SUM OVER의 기본 범위는 Oracle·SQLite 모두
 * "RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW" — 같은 값의 행은 한꺼번에 더해진다.
 * "한 행씩 따로 누적(ROWS)" 함정은 같은 값끼리의 순서가 정해져 있지 않으므로 JS로 계산한 글자로 만든다.
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { pickNames } from './data'

const valueAt = (query: string, name: string) => ({
  sql: `SELECT TOTAL FROM (${query}) WHERE ENAME = '${name}'`,
  format: format.scalar,
})

function rangeTies(rng: Rng): TemplateScenario {
  const n = rng.int(6, 8)
  const names = pickNames(rng, n)
  const sals = names.map(() => rng.pick([1000, 1500, 2000, 2500, 3000]))
  // 같은 급여가 반드시 생기게: 한 행의 급여를 다른 행과 같게
  const [i, j] = rng.shuffle([...Array(n).keys()]) as [number, number]
  sals[j] = sals[i] ?? 1000
  const rows: CellValue[][] = names.map((name, k) => [k + 1, name, sals[k] ?? 1000])
  const tiedSal = sals[i] ?? 1000
  const tied = rows.filter((r) => r[2] === tiedSal)
  const target = rng.pick(tied)
  const name = target[1] as string

  const less = sals.filter((s) => s < tiedSal).reduce((a, b) => a + b, 0)
  const query = 'SELECT ENAME, SAL, SUM(SAL) OVER (ORDER BY SAL) AS TOTAL FROM EMP'
  return {
    tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'SAL'], rows }],
    stem: `다음 [EMP] 테이블에 SQL을 실행했을 때, ENAME이 '${name}'인 행의 TOTAL 값은?`,
    sql: 'SELECT ENAME, SAL,\n       SUM(SAL) OVER (ORDER BY SAL) AS TOTAL\n  FROM EMP;',
    answer: valueAt(query, name),
    traps: [
      { text: String(less + tiedSal), why: '같은 SAL 값의 행도 한 행씩 따로 누적한(ROWS 방식으로 본)' },
      { sql: 'SELECT SUM(SAL) FROM EMP', format: format.scalar, why: 'ORDER BY가 있어도 전체 합계가 나온다고 본' },
      { text: String(less), why: '현재 행을 빼고 그 앞 행까지만 더한' },
    ],
    fillers: [tiedSal, less + 2 * tiedSal + 500, less + tiedSal + 500].map(String),
    steps: [{ label: '누적 합계 계산 결과 (SAL 순)', sql: `${query} ORDER BY SAL, ENAME` }],
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. 윈도우에 ORDER BY만 쓰면 범위가 "처음부터 현재 행까지"인데, 기본 방식이 RANGE라서 **현재 행과 정렬 값이 같은 행(동순위)까지 한꺼번에** 더합니다. SAL이 ${tiedSal}인 행이 여럿이므로 그 행들은 모두 같은 TOTAL을 갖습니다. 한 행씩 따로 누적하려면 \`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\`를 명시해야 합니다.`,
    examPoint: 'SUM() OVER (ORDER BY …)의 기본 범위는 RANGE — 같은 값의 행은 같은 누적값을 갖는다.',
  }
}

function partitionCumulative(rng: Rng): TemplateScenario {
  const n = rng.int(6, 8)
  const names = pickNames(rng, n)
  const rows: CellValue[][] = names.map((name, k) => [k + 1, name, rng.pick([10, 20]), rng.int(5, 30) * 100])
  // 앞쪽이 아닌 행을 골라야 누적이 드러난다
  const target = rng.pick(rows.slice(2))
  const name = target[1] as string
  const q = (window: string) => `SELECT ENAME, DEPTNO, SAL, SUM(SAL) OVER (${window}) AS TOTAL FROM EMP`
  const main = q('PARTITION BY DEPTNO ORDER BY EMPNO')
  return {
    tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'DEPTNO', 'SAL'], rows }],
    stem: `다음 [EMP] 테이블에 SQL을 실행했을 때, ENAME이 '${name}'인 행의 TOTAL 값은?`,
    sql: 'SELECT ENAME, DEPTNO, SAL,\n       SUM(SAL) OVER (PARTITION BY DEPTNO\n                      ORDER BY EMPNO) AS TOTAL\n  FROM EMP;',
    answer: valueAt(main, name),
    traps: [
      { ...valueAt(q('ORDER BY EMPNO'), name), why: 'PARTITION BY를 무시하고 전체 사원을 누적한' },
      { ...valueAt(q('PARTITION BY DEPTNO'), name), why: 'ORDER BY를 무시하고 부서 전체 합계가 나온다고 본' },
      {
        // 부서의 첫 행이면 앞 행이 없어 NULL → 보기에서는 0으로
        sql: valueAt(q('PARTITION BY DEPTNO ORDER BY EMPNO ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING'), name).sql,
        format: (r) => (format.scalar(r) === 'NULL' ? '0' : format.scalar(r)),
        why: '현재 행을 빼고 그 앞 행까지만 더한',
      },
    ],
    fillers: [Number(target[3]) * 2, Number(target[3]) + 500].map(String),
    steps: [{ label: '부서별 누적 합계 계산 결과', sql: `${main} ORDER BY DEPTNO, ENAME` }],
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. PARTITION BY DEPTNO로 부서마다 따로 계산하고, 그 안에서 ORDER BY EMPNO 순서로 "부서의 첫 사원부터 현재 사원까지" 급여를 더합니다. '${name}'은 ${String(target[2])}번 부서이므로, 같은 부서에서 사번이 '${name}'보다 작거나 같은 사원의 급여만 더해집니다.`,
    examPoint: 'SUM() OVER (PARTITION BY a ORDER BY b) = a 그룹 안에서 b 순서로 처음부터 현재 행까지 누적.',
  }
}

export const TP08 = defineTemplate({
  id: 'TP08',
  subject: 2,
  chapter: 'S2-04',
  topic: '집계 윈도우 함수 누적 값',
  type: 'sql_result',
  difficulty: 3,
  tags: ['윈도우 함수', 'SUM OVER', '누적', 'RANGE', 'ROWS'],
  numericChoices: true,
  build(rng) {
    return rng.pick([rangeTies, partitionCumulative])(rng)
  },
})
