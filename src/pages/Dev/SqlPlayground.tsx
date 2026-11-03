import { useState } from 'react'
import { Button, Card, DataTable } from '../../components'
import type { TableData } from '../../domain'
import { withDatabase } from '../../engine'
import { useSqlEngine } from '../../app/useSqlEngine'

/** 견본 테이블 — NULL이 섞인 사원 표 */
const SAMPLE: TableData = {
  name: 'EMP',
  columns: ['EMPNO', 'ENAME', 'DEPTNO', 'SAL', 'COMM'],
  rows: [
    [1, 'KING', 10, 5000, null],
    [2, 'CLARK', 10, 2450, 300],
    [3, 'SCOTT', 20, 3000, null],
    [4, 'ADAMS', 20, 1100, 0],
    [5, 'JAMES', 30, 950, 500],
  ],
}

const DEFAULT_SQL = `SELECT DEPTNO, COUNT(*) AS CNT, COUNT(COMM) AS COMM_CNT, SUM(SAL + COMM) AS S
FROM EMP
GROUP BY DEPTNO
ORDER BY DEPTNO;`

/** 임시 견본 (T4-2) — sql.js 로딩 표시와 실행 결과 확인용 */
export function SqlPlayground() {
  const { status } = useSqlEngine()
  const [sql, setSql] = useState(DEFAULT_SQL)
  const [result, setResult] = useState<TableData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setError(null)
    try {
      setResult(await withDatabase([SAMPLE], (db) => db.query(sql)))
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Card title="SQL 실행기">
      <p>
        상태: <strong data-testid="sql-status">{STATUS_TEXT[status]}</strong>
      </p>
      <DataTable name={SAMPLE.name} columns={SAMPLE.columns} rows={SAMPLE.rows} />
      <label>
        실행할 SQL (SQLite)
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={5}
          spellCheck={false}
          style={{ display: 'block', width: '100%', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}
        />
      </label>
      <Button onClick={() => void run()} disabled={status === 'loading'}>
        {status === 'loading' ? '불러오는 중…' : '실행'}
      </Button>
      {result && <DataTable caption={`실행 결과 (${result.rows.length}행)`} columns={result.columns} rows={result.rows} />}
      {error && (
        <pre role="alert" style={{ whiteSpace: 'pre-wrap', color: 'var(--color-danger)' }}>
          {error}
        </pre>
      )}
    </Card>
  )
}

const STATUS_TEXT = {
  idle: '아직 불러오지 않음 (처음 실행할 때 불러옵니다)',
  loading: 'SQL 실행기 불러오는 중…',
  ready: '준비됨',
  error: '불러오기 실패 — 다시 실행하면 재시도합니다',
} as const
