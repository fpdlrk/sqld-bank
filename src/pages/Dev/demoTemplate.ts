import { defineTemplate, format } from '../../engine'
import type { CellValue } from '../../domain'

/**
 * 견본 템플릿 (T4-3 확인용, #/dev 전용) — 실제 템플릿 TP01~ 은 engine/templates/ 에 만든다.
 * WHERE SAL >= x 결과 건수. 함정: 경계 제외(>), NULL을 조건에 포함, 부등호 방향 착각
 */
export const demoTemplate = defineTemplate({
  id: 'DEMO',
  subject: 2,
  chapter: 'S1-04',
  topic: '비교 연산과 NULL (견본)',
  type: 'sql_result',
  difficulty: 1,
  numericChoices: true,
  build(rng) {
    const n = rng.int(6, 9)
    const sals = Array.from({ length: n }, () => rng.int(10, 30) * 100)
    // NULL 2행은 꼭 넣는다 (docs/04 §7: NULL 문제면 NULL ≥ 2행)
    const nullAt = new Set(rng.shuffle([...Array(n).keys()]).slice(0, 2))
    const rows: CellValue[][] = sals.map((sal, i) => [i + 1, nullAt.has(i) ? null : sal])
    const x = rng.pick(sals.filter((_, i) => !nullAt.has(i)))

    const sql = `SELECT * FROM EMP WHERE SAL >= ${x};`
    return {
      tables: [{ name: 'EMP', columns: ['EMPNO', 'SAL'], rows }],
      stem: '다음 [EMP] 테이블에 SQL을 실행했을 때 결과 행의 수는?',
      sql,
      answer: { sql, format: format.count },
      traps: [
        { sql: `SELECT * FROM EMP WHERE SAL > ${x}`, format: format.count, why: '`>=`의 경계값을 빼고 센' },
        {
          sql: `SELECT * FROM EMP WHERE SAL >= ${x} OR SAL IS NULL`,
          format: format.count,
          why: 'SAL이 NULL인 행도 조건을 만족한다고 본',
        },
        { sql: `SELECT * FROM EMP WHERE SAL < ${x}`, format: format.count, why: '부등호 방향을 반대로 읽은' },
      ],
      fillers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(format.countOf),
      explain: ({ answerMark, answerText }) =>
        `정답은 ${answerMark}(${answerText})입니다. \`SAL >= ${x}\`는 SAL이 ${x}과 같거나 큰 행만 남기며, SAL이 NULL인 행은 비교 결과가 UNKNOWN이 되어 걸러집니다.`,
      examPoint: 'NULL과의 비교는 TRUE가 아니라 UNKNOWN — WHERE에서 걸러진다.',
    }
  },
})
