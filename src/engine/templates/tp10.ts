/**
 * TP10 (S3-01 / S3-02) INSERT·UPDATE·DELETE + SAVEPOINT·ROLLBACK·COMMIT 시나리오 (docs/04 §7)
 * 변형: ROLLBACK TO SAVEPOINT 후 COMMIT / COMMIT 뒤의 ROLLBACK
 *
 * Oracle은 첫 DML부터 트랜잭션이 시작되지만, SQLite는 BEGIN이 없으면 문장마다 바로 저장(자동 커밋)한다.
 * 그래서 실행할 때는 맨 앞에 BEGIN을 넣고, COMMIT 뒤에도 BEGIN을 다시 넣어 Oracle과 같은 동작을 만든다.
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type SqlProbe, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { pickNames, salary } from './data'

const SELECT = 'SELECT COUNT(*) AS CNT, SUM(SAL) AS TOTAL FROM EMP;'

/** 화면용 문장들 → SQLite 실행용 (BEGIN 넣기) + 마지막 SELECT */
export function toExec(statements: string[]): string {
  const body = statements.map((s) => (s === 'COMMIT;' ? 'COMMIT;\nBEGIN;' : s))
  return ['BEGIN;', ...body, SELECT].join('\n')
}
const run = (statements: string[]): SqlProbe => ({ sql: toExec(statements), format: format.value })

export const TP10 = defineTemplate({
  id: 'TP10',
  subject: 2,
  chapter: 'S3-02',
  topic: '트랜잭션 시나리오 최종 결과',
  type: 'scenario',
  difficulty: 3,
  tags: ['TCL', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'DML'],
  build(rng: Rng): TemplateScenario {
    const n = rng.int(4, 6)
    const rows: CellValue[][] = pickNames(rng, n).map((name, i) => [i + 1, name, rng.pick([10, 20]), salary(rng, 1000, 3000)])
    const sals = rows.map((r) => r[3] as number).sort((a, b) => a - b)
    const dept = rng.pick([10, 20])
    const raise = rng.pick([100, 200, 500])
    const cut = sals[rng.int(1, Math.max(1, n - 2))] ?? 2000 // 1행 이상 지워지는 기준
    const newSal = rng.int(10, 30) * 100

    const update = `UPDATE EMP SET SAL = SAL + ${raise} WHERE DEPTNO = ${dept};`
    const del = `DELETE FROM EMP WHERE SAL < ${cut};`
    const insert = `INSERT INTO EMP VALUES (${n + 1}, 'NEW', ${dept}, ${newSal});`
    const variant = rng.pick(['savepoint', 'commit'] as const)

    let statements: string[]
    let traps: TemplateScenario['traps']
    let story: string
    if (variant === 'savepoint') {
      const k = rng.pick([1, 2])
      statements = [update, 'SAVEPOINT SP1;', del, 'SAVEPOINT SP2;', insert, `ROLLBACK TO SAVEPOINT SP${k};`, 'COMMIT;']
      const other = k === 1 ? 2 : 1
      traps = [
        { ...run(statements.map((s) => (s.startsWith('ROLLBACK') ? `ROLLBACK TO SAVEPOINT SP${other};` : s))), why: `되돌릴 지점을 SP${other}로 착각한` },
        { ...run(statements.filter((s) => !s.startsWith('ROLLBACK'))), why: 'ROLLBACK TO를 무시한' },
        { ...run([]), why: 'ROLLBACK TO가 트랜잭션 전체(UPDATE까지)를 되돌린다고 본' },
      ]
      story =
        k === 1
          ? 'ROLLBACK TO SAVEPOINT SP1은 SP1 이후의 DELETE와 INSERT만 취소하고, SP1 이전의 UPDATE는 그대로 둡니다. 이어지는 COMMIT이 UPDATE만 반영된 상태를 확정합니다.'
          : 'ROLLBACK TO SAVEPOINT SP2는 SP2 이후의 INSERT만 취소합니다. SP2 이전의 UPDATE와 DELETE는 남아 있다가 이어지는 COMMIT으로 확정됩니다.'
    } else {
      statements = [update, 'COMMIT;', del, 'SAVEPOINT SP1;', insert, 'ROLLBACK;']
      traps = [
        { ...run([]), why: 'ROLLBACK이 이미 COMMIT된 UPDATE까지 되돌린다고 본' },
        { ...run(statements.filter((s) => s !== 'ROLLBACK;')), why: 'ROLLBACK을 무시한' },
        { ...run(statements.map((s) => (s === 'ROLLBACK;' ? 'ROLLBACK TO SAVEPOINT SP1;' : s))), why: 'ROLLBACK이 마지막 SAVEPOINT까지만 되돌린다고 본' },
      ]
      story =
        'COMMIT은 그때까지의 UPDATE를 영구히 확정하고 트랜잭션을 끝냅니다. 그 뒤의 DELETE부터 새 트랜잭션이 시작되며, 마지막 ROLLBACK은 SAVEPOINT와 상관없이 이 새 트랜잭션 전체(DELETE, INSERT)를 취소합니다. 결국 UPDATE만 반영된 상태가 남습니다.'
    }

    return {
      tables: [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'DEPTNO', 'SAL'], rows }],
      stem: '[EMP] 테이블에 다음 SQL을 차례로 실행했을 때, 마지막 SELECT의 결과 (CNT, TOTAL)로 알맞은 것은? (실행 전 데이터는 모두 COMMIT된 상태이다)',
      sql: [...statements, SELECT].join('\n'),
      answer: run(statements),
      traps,
      steps: [{ label: '모든 문장을 실행한 뒤의 EMP', sql: `${toExec(statements)}\nSELECT * FROM EMP ORDER BY EMPNO;` }],
      explain: ({ answerMark, answerText }) =>
        `정답은 ${answerMark}(${answerText})입니다. ${story}`,
      examPoint: 'ROLLBACK TO는 그 SAVEPOINT 이후만, ROLLBACK은 마지막 COMMIT 이후 전체를 취소한다. COMMIT된 변경은 되돌릴 수 없다.',
    }
  },
})
