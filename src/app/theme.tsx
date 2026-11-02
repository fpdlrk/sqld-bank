import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * 테마 상태 (T1-2)
 *
 * 'system' = OS 설정을 따름 / 'light' / 'dark' = 수동 고정.
 *
 * 저장 위치가 IndexedDB가 아니라 localStorage인 이유:
 * 테마는 첫 화면이 그려지기 **전에** 동기적으로 알아야 한다. IndexedDB는 비동기라
 * 읽는 동안 흰 화면이 번쩍이는 문제가 생긴다. 앱 데이터(풀이 기록 등)는 규칙대로
 * storage 어댑터를 거친다.
 */
export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'sqld-bank.theme'

interface ThemeContextValue {
  /** 사용자가 고른 값 */
  preference: ThemePreference
  /** 실제로 적용된 테마 ('system'일 때 OS 설정이 반영된 결과) */
  resolved: 'light' | 'dark'
  setPreference: (next: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // 시크릿 모드 등에서 localStorage가 막혀 있어도 앱은 동작해야 한다
  }
  return 'system'
}

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [systemDark, setSystemDark] = useState<boolean>(prefersDark)

  // OS 테마가 바뀌면 'system' 선택일 때 따라간다
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: 'light' | 'dark' =
    preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  // tokens.css가 보는 것은 <html data-theme> 한 곳뿐이다.
  // 'system'일 때는 속성을 지워서 CSS의 prefers-color-scheme 쪽에 맡긴다.
  useEffect(() => {
    const root = document.documentElement
    if (preference === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', preference)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 저장 실패해도 현재 세션 동안은 적용된다
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme은 ThemeProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
