/**
 * TP02 (S1-03 / M2-04) NULL과 집계 함수 결과값 — docs/04 §7
 * 변형: COUNT(*)·COUNT(컬럼)·SUM / SUM(a+b) vs SUM(a)+SUM(b) / AVG
 *
 * AVG 변형은 Oracle(나눗셈 결과 소수)과 SQLite(정수 나눗셈)의 차이가 생기지 않도록
 * 정답과 함정이 모두 정수로 떨어지는 데이터만 쓴다.
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { pickIndexes, pickNames, salary } from './data'

const STEM = '다음 [EMP] 테이블에 SQL을 실행한 결과로 알맞은 것은?'
const COLUMNS = ['EMPNO', 'ENAME', 'SAL', 'COMM']

/** COMM: NULL 2~3행(docs/04 §7: NULL ≥ 2행), 0인 행이 섞일 수 있음 */
function makeRows(rng: Rng, n: number, nulls: number, comms?: number[]): CellValue[][] {
  const names = pickNames(rng, n)
  const nullAt = pickIndexes(rng, n, nulls)
  let k = 0
  return names.map((name, i) => {
    const comm = nullAt.has(i) ? null : (comms?.[k++] ?? (rng.chance(0.2) ? 0 : rng.int(1, 9) * 50))
    return [i + 1, name, salary(rng, 1000, 3000), comm]
  })
}

function countSum(rng: Rng): TemplateScenario {
  const rows = makeRows(rng, rng.int(5, 7), rng.int(2, 3))
  const sql = 'SELECT COUNT(*) AS A, COUNT(COMM) AS B, SUM(COMM) AS C FROM EMP'
  return {
    tables: [{ name: 'EMP', columns: COLUMNS, rows }],
    stem: `${STEM} (A, B, C 순서)`,
    sql: 'SELECT COUNT(*) AS A, COUNT(COMM) AS B, SUM(COMM) AS C\n  FROM EMP;',
    answer: { sql },
    traps: [
      { sql: 'SELECT COUNT(*), COUNT(*), SUM(COMM) FROM EMP', why: 'COUNT(COMM)도 NULL인 행까지 센다고 본' },
      { sql: 'SELECT COUNT(*), COUNT(COMM), NULL FROM EMP', why: 'NULL이 하나라도 있으면 SUM 결과가 NULL이 된다고 본' },
      { sql: 'SELECT COUNT(COMM), COUNT(COMM), SUM(COMM) FROM EMP', why: 'COUNT(*)도 NULL이 있는 행을 뺀다고 본' },
    ],
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. COUNT(*)는 행 자체를 세므로 NULL과 상관없이 전체 행 수가 나오고, COUNT(COMM)은 COMM이 NULL이 아닌 행만 셉니다. SUM은 NULL을 건너뛰고 나머지 값만 더하므로 NULL이 섞여 있어도 NULL이 되지 않습니다. COMM이 0인 행은 NULL과 달리 "값이 있는" 행이라 COUNT(COMM)에 포함됩니다.`,
    examPoint: '집계 함수는 NULL을 건너뛴다 — 단, COUNT(*)는 행을 세므로 NULL 행도 포함.',
  }
}

function sumExpr(rng: Rng): TemplateScenario {
  const rows = makeRows(rng, rng.int(5, 7), rng.int(2, 3))
  return {
    tables: [{ name: 'EMP', columns: COLUMNS, rows }],
    stem: `${STEM} (A, B 순서)`,
    sql: 'SELECT SUM(SAL + COMM) AS A,\n       SUM(SAL) + SUM(COMM) AS B\n  FROM EMP;',
    answer: { sql: 'SELECT SUM(SAL + COMM), SUM(SAL) + SUM(COMM) FROM EMP' },
    traps: [
      { sql: 'SELECT SUM(SAL + IFNULL(COMM, 0)), SUM(SAL) + SUM(COMM) FROM EMP', why: 'SAL + NULL을 SAL처럼(NULL을 0으로) 계산한' },
      { text: 'NULL, NULL', why: 'NULL이 섞이면 SUM 결과도 NULL이 된다고 본' },
      { sql: 'SELECT SUM(SAL + COMM), SUM(SAL + COMM) FROM EMP', why: 'A와 B가 항상 같다고 본' },
    ],
    steps: [
      {
        label: '행마다 SAL + COMM',
        sql: 'SELECT EMPNO, SAL, COMM, SAL + COMM AS "SAL + COMM" FROM EMP ORDER BY EMPNO',
      },
    ],
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. A는 행마다 SAL + COMM을 먼저 계산하는데, COMM이 NULL인 행은 SAL + NULL = NULL이 되고 SUM은 이 NULL을 건너뜁니다. 그래서 COMM이 NULL인 사원의 급여가 통째로 빠집니다. B는 SUM(SAL)과 SUM(COMM)을 따로 구한 뒤 더하므로 모든 사원의 SAL이 합계에 들어갑니다. "더한 뒤 합계"냐 "합계를 낸 뒤 더하기"냐에 따라 결과가 달라지는 것이 핵심입니다.`,
    examPoint: 'NULL이 포함된 산술 연산 결과는 NULL — SUM(a+b)와 SUM(a)+SUM(b)는 다를 수 있다.',
  }
}

/** 평균이 정수로 떨어지는 COMM 값 만들기 — 실패하면 undefined */
function divisibleComms(rng: Rng, n: number, k: number): number[] | undefined {
  for (let i = 0; i < 400; i++) {
    const comms = Array.from({ length: k }, () => rng.int(1, 12) * 50)
    const sum = comms.reduce((s, v) => s + v, 0)
    if (sum % k === 0 && sum % n === 0) return comms
  }
  return undefined
}

function avg(rng: Rng): TemplateScenario {
  const n = rng.pick([5, 6])
  const nulls = 2
  const comms = divisibleComms(rng, n, n - nulls)
  if (!comms) return countSum(rng)
  const rows = makeRows(rng, n, nulls, comms)
  return {
    tables: [{ name: 'EMP', columns: COLUMNS, rows }],
    stem: STEM,
    sql: 'SELECT AVG(COMM)\n  FROM EMP;',
    answer: { sql: 'SELECT AVG(COMM) FROM EMP', format: format.scalar },
    traps: [
      { sql: 'SELECT SUM(COMM) / COUNT(*) FROM EMP', format: format.scalar, why: 'NULL을 0으로 보고 전체 행 수로 나눈' },
      { sql: 'SELECT SUM(COMM) FROM EMP', format: format.scalar, why: '평균 대신 합계를 구한' },
      { text: 'NULL', why: 'NULL이 하나라도 있으면 AVG 결과가 NULL이 된다고 본' },
    ],
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. AVG(COMM)은 NULL을 건너뛰고 "값이 있는 행"만으로 평균을 냅니다. 즉 SUM(COMM) / COUNT(COMM)이며, 전체 행 수(COUNT(*))로 나누지 않습니다. NULL을 0으로 보고 평균을 내고 싶다면 AVG(NVL(COMM, 0))처럼 써야 합니다.`,
    examPoint: 'AVG(컬럼) = SUM(컬럼) / COUNT(컬럼) — NULL 행은 분모에서도 빠진다.',
  }
}

export const TP02 = defineTemplate({
  id: 'TP02',
  subject: 2,
  chapter: 'S1-03',
  topic: 'NULL과 집계 함수 결과',
  type: 'sql_result',
  difficulty: 2,
  tags: ['NULL', '집계함수', 'COUNT', 'SUM', 'AVG'],
  build(rng) {
    return rng.pick([countSum, sumExpr, avg])(rng)
  },
})
