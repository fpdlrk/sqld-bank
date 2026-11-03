/**
 * sql.js(SQLite WASM) 실행기 (T4-2)
 *
 * - WASM은 처음 쓸 때 한 번만 불러온다 (약 680KB). 앱 첫 화면에는 포함하지 않는다.
 * - WASM 파일은 Vite가 dist/assets 에 함께 넣으므로(로컬 번들) 인터넷 없이도 동작한다.
 * - 결과는 화면의 DataTable이 바로 쓰는 TableData 모양으로 돌려준다.
 *
 * 주의: 여기서 실행되는 것은 SQLite다. Oracle 전용 문법은 docs/04 §6 규칙으로 바꾼 SQL(sqlExec)을 넣는다.
 */
import type { SqlJsStatic, Database, SqlValue } from 'sql.js'
import type { CellValue, TableData } from '../domain'

// ───────────────────────────── WASM 불러오기 ─────────────────────────────

export type SqlEngineStatus = 'idle' | 'loading' | 'ready' | 'error'
type Loader = () => Promise<SqlJsStatic>

/** 브라우저(앱)용: 브라우저 빌드 + 앱에 함께 묶인 WASM 파일 주소 */
const browserLoader: Loader = async () => {
  const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm-browser.wasm?url'),
  ])
  return initSqlJs({ locateFile: () => wasmUrl })
}

let loader: Loader = browserLoader
let enginePromise: Promise<SqlJsStatic> | undefined
let status: SqlEngineStatus = 'idle'
const listeners = new Set<(s: SqlEngineStatus) => void>()

function setStatus(next: SqlEngineStatus) {
  status = next
  for (const fn of listeners) fn(next)
}

/** sql.js 준비 (여러 번 불러도 실제 로딩은 한 번). 실패하면 다음 호출 때 다시 시도한다 */
export function loadSqlEngine(): Promise<SqlJsStatic> {
  if (!enginePromise) {
    setStatus('loading')
    enginePromise = loader().then(
      (sql) => {
        setStatus('ready')
        return sql
      },
      (err: unknown) => {
        enginePromise = undefined
        setStatus('error')
        throw new Error(`SQL 실행기를 불러오지 못했습니다: ${err instanceof Error ? err.message : String(err)}`)
      },
    )
  }
  return enginePromise
}

export function getSqlEngineStatus(): SqlEngineStatus {
  return status
}

/** 상태가 바뀔 때 알림 받기 (로딩 표시용). 돌려받은 함수를 부르면 해제 */
export function onSqlEngineStatus(fn: (s: SqlEngineStatus) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 테스트용 — 불러오는 방법을 바꾸고 상태를 처음으로 되돌린다 (undefined면 브라우저용으로) */
export function setSqlEngineLoader(next: Loader | undefined): void {
  loader = next ?? browserLoader
  enginePromise = undefined
  setStatus('idle')
}

// ───────────────────────────── 실행 ─────────────────────────────

export interface SqlDatabase {
  /** 테이블 만들기 + 행 넣기. TableData.name 이 테이블 이름 */
  createTables(tables: readonly TableData[]): void
  /** 결과가 필요 없는 문장 실행 (INSERT, UPDATE, CREATE …) */
  run(sql: string): void
  /** 마지막 SELECT 결과. 결과를 내는 문장이 없으면 오류 */
  query(sql: string): TableData
  /** 결과를 내는 문장마다 하나씩 (여러 문장을 ;로 이어서 넣을 때) */
  queryAll(sql: string): TableData[]
  close(): void
}

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`

/** sql.js 값 → 표 칸 값 (BLOB은 쓰지 않으므로 표시용 글자로) */
const toCell = (v: SqlValue): CellValue => (v instanceof Uint8Array ? '[BLOB]' : v)

function wrapError(err: unknown, sql: string): Error {
  const msg = err instanceof Error ? err.message : String(err)
  return new Error(`SQL 실행 오류: ${msg}\n--- 실행한 SQL ---\n${sql}`)
}

function wrap(db: Database): SqlDatabase {
  function queryAll(sql: string): TableData[] {
    const results: TableData[] = []
    try {
      // 문장을 하나씩 실행 — 0행 결과도 컬럼 이름을 남기기 위해 db.exec 대신 사용
      for (const stmt of db.iterateStatements(sql)) {
        try {
          const columns = stmt.getColumnNames()
          if (columns.length === 0) {
            stmt.step()
            continue
          }
          const rows: CellValue[][] = []
          while (stmt.step()) rows.push(stmt.get().map(toCell))
          results.push({ columns, rows })
        } finally {
          stmt.free()
        }
      }
    } catch (err) {
      throw wrapError(err, sql)
    }
    return results
  }

  return {
    createTables(tables) {
      for (const t of tables) {
        if (!t.name) throw new Error('테이블을 만들려면 name이 필요합니다')
        const name = quoteIdent(t.name)
        try {
          db.run(`CREATE TABLE ${name} (${t.columns.map(quoteIdent).join(', ')})`)
          const insert = db.prepare(`INSERT INTO ${name} VALUES (${t.columns.map(() => '?').join(', ')})`)
          try {
            for (const row of t.rows) insert.run(row)
          } finally {
            insert.free()
          }
        } catch (err) {
          throw new Error(`테이블 ${t.name}을(를) 만들지 못했습니다: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    },
    run(sql) {
      try {
        db.run(sql)
      } catch (err) {
        throw wrapError(err, sql)
      }
    },
    query(sql) {
      const all = queryAll(sql)
      const last = all[all.length - 1]
      if (!last) throw new Error(`결과를 돌려주는 문장(SELECT)이 없습니다:\n${sql}`)
      return last
    },
    queryAll,
    close() {
      db.close()
    },
  }
}

/** 빈 메모리 DB 열기 (+ 테이블 미리 만들기). 다 쓰면 close() */
export async function openDatabase(tables: readonly TableData[] = []): Promise<SqlDatabase> {
  const SQL = await loadSqlEngine()
  const db = wrap(new SQL.Database())
  try {
    db.createTables(tables)
  } catch (err) {
    db.close()
    throw err
  }
  return db
}

/** DB를 열고 fn을 실행한 뒤 반드시 닫는다 — 템플릿이 주로 쓰는 형태 */
export async function withDatabase<T>(tables: readonly TableData[], fn: (db: SqlDatabase) => T): Promise<T> {
  const db = await openDatabase(tables)
  try {
    return fn(db)
  } finally {
    db.close()
  }
}
