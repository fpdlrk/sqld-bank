/**
 * TP18 (S3-01) INSERT·UPDATE·DELETE 연속 실행 결과 — docs/04 §7
 * 핵심: 뒤의 문장은 앞 문장이 바꾼 데이터를 기준으로 동작한다.
 * 변형: DELETE 조건 방향(>= / <), 바뀌는 부서
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type SqlProbe, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { pickNames, salary } from './data'

const SELECT = 'SELECT COUNT(*) AS CNT, SUM(SAL) AS TOTAL FROM EMP;'
const run = (statements: string[]): SqlProbe => ({ sql: [...statements, SELECT].join('\n'), format: format.value })

export const TP18 = defineTemplate({
  id: 'TP18',
  subject: 2,
  chapter: 'S3-01',
  topic: 'DML 연속 실행 결과',
  type: 'scenario',
  difficulty: 2,
  tags: ['DML', 'INSERT', 'UPDATE', 'DELETE'],
  build(rng: Rng): TemplateScenario {
    const n = rng.int(4, 6)
    const rows: CellValue[][] = pickNames(rng, n).map((name, i) => [i + 1, name, rng.pick([10, 20]), salary(rng, 1000, 3000)])
    const dept = rng.pick([10, 20])
    const raise = rng.pick([300, 500, 800])
    const newSal = salary(rng, 1500, 2800)
    const ge = rng.chance(0.5)
    // 기준값: 새로 넣는 급여 근처 → INSERT·UPDATE 순서에 따라 지워지는 행이 달라진다
    const cut = newSal + rng.pick([100, 200, 300]) * (ge ? 1 : -1) + (ge ? 0 : raise)

    const insert = `INSERT INTO EMP VALUES (${n + 1}, 'NEW', ${dept}, ${newSal});`
    const update = `UPDATE EMP SET SAL = SAL + ${raise} WHERE DEPTNO = ${dept};`
    const del = `DELETE FROM EMP WHERE SAL ${ge ? '>=' : '<'} ${cut};`
    const statements = [insert, update, del]

    return {
      tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'DEPTNO', 'SAL'], rows }],
      stem: '[EMP] 테이블에 다음 SQL을 차례로 실행했을 때, 마지막 SELECT의 결과 (CNT, TOTAL)로 알맞은 것은?',
      sql: [...statements, SELECT].join('\n'),
      answer: run(statements),
      traps: [
        { ...run([insert, update]), why: 'DELETE를 빠뜨린' },
        { ...run([insert, del, update]), why: 'DELETE가 UPDATE 이전의 급여로 판단한다고 본' },
        { ...run([update, insert, del]), why: '방금 INSERT한 행에는 UPDATE가 적용되지 않는다고 본' },
      ],
      steps: [{ label: '모든 문장을 실행한 뒤의 EMP', sql: `${statements.join('\n')}\nSELECT * FROM EMP ORDER BY EMPNO;` }],
      explain: ({ answerMark, answerText }) =>
        `정답은 ${answerMark}(${answerText})입니다. DML은 앞 문장의 결과를 그대로 이어받습니다. INSERT로 ${dept}번 부서에 급여 ${newSal}인 NEW가 추가되고, UPDATE는 방금 넣은 NEW까지 포함해 ${dept}번 부서 전원의 급여를 ${raise}씩 올립니다. 마지막 DELETE는 이렇게 바뀐 급여를 기준으로 ${ge ? `${cut} 이상` : `${cut} 미만`}인 행을 지웁니다. 단계마다 테이블 상태를 적어 가며 계산하면 실수가 없습니다.`,
      examPoint: 'DML은 앞 문장이 바꾼 데이터를 기준으로 실행된다 — 단계별로 테이블 상태를 적어 가며 계산.',
    }
  },
})
