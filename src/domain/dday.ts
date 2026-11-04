/**
 * 시험 D-day (T6-5)
 * 날짜는 "YYYY-MM-DD" 문자열로 저장하고, 기기의 현지 날짜 기준으로 센다 (시각은 무시).
 */

/** 시험일을 저장하는 meta 키 */
export const EXAM_DATE_KEY = 'examDate'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** "2026-11-27" 같은 올바른 날짜인지 */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const m = DATE_RE.exec(value)
  if (!m) return false
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
}

/** 오늘(현지 날짜)부터 시험일까지 남은 날 수. 시험 당일 0, 지나면 음수 */
export function daysUntil(examDate: string, today: Date = new Date()): number {
  const [y, m, d] = examDate.split('-').map(Number) as [number, number, number]
  const exam = Date.UTC(y, m - 1, d)
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((exam - now) / 86_400_000)
}

/** 23 → "D-23", 0 → "D-Day", -3 → "D+3" */
export function formatDDay(days: number): string {
  return days > 0 ? `D-${days}` : days === 0 ? 'D-Day' : `D+${-days}`
}
