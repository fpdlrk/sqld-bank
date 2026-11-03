import { useCallback, useEffect, useState } from 'react'
import { getSqlEngineStatus, loadSqlEngine, onSqlEngineStatus, type SqlEngineStatus } from '../engine'

/**
 * SQL 실행기(sql.js) 준비 상태 (T4-2)
 * 화면에 "SQL 실행기 불러오는 중…"을 띄우거나 실패 시 [다시 시도]를 보여 줄 때 쓴다.
 *
 * autoLoad가 true면 화면이 열릴 때 바로 불러오기 시작한다.
 */
export function useSqlEngine(autoLoad = false): { status: SqlEngineStatus; load: () => void } {
  const [status, setStatus] = useState(getSqlEngineStatus)

  useEffect(() => {
    const off = onSqlEngineStatus(setStatus)
    setStatus(getSqlEngineStatus())
    return off
  }, [])

  const load = useCallback(() => {
    // 실패는 상태('error')로 알 수 있으므로 여기서는 삼킨다
    loadSqlEngine().catch(() => {})
  }, [])

  useEffect(() => {
    if (autoLoad) load()
  }, [autoLoad, load])

  return { status, load }
}
