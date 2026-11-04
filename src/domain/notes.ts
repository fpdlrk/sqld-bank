/**
 * 오답노트 상태 바꾸기 (T6-2) — 메모·북마크·"이제 안다"
 * 모두 새 Note를 돌려주는 순수 함수. 저장은 화면 쪽에서 storage.putNote로 한다.
 */
import type { IsoDateTime, Note, QuestionRef, QuestionReport, ReportKind } from './types'

const iso = (now: Date) => now.toISOString() as IsoDateTime

/** 아직 상태가 없는 문제의 빈 Note */
export function emptyNote(questionRef: QuestionRef, now: Date = new Date()): Note {
  return { questionRef, bookmarked: false, memo: '', mastered: false, updatedAt: iso(now) }
}

export function setBookmark(note: Note, bookmarked: boolean, now: Date = new Date()): Note {
  return { ...note, bookmarked, updatedAt: iso(now) }
}

export function setMemo(note: Note, memo: string, now: Date = new Date()): Note {
  return { ...note, memo, updatedAt: iso(now) }
}

/** "이제 안다" 켜기/끄기 — 켤 때 시각을 남겨, 그 뒤에 다시 틀리면 오답노트에 다시 나오게 한다 */
export function setMastered(note: Note, mastered: boolean, now: Date = new Date()): Note {
  const { masteredAt: _old, ...rest } = note
  return mastered ? { ...rest, mastered, masteredAt: iso(now), updatedAt: iso(now) } : { ...rest, mastered, updatedAt: iso(now) }
}

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  answer: '정답이 틀림',
  explanation: '해설이 틀림·부족',
  typo: '본문·보기 오타',
  sql: 'SQL·실행 결과 오류',
  other: '기타',
}

/** 오류 신고 남기기·고치기 (T7-5). report가 null이면 신고 취소 */
export function setReport(
  note: Note,
  report: { kind: ReportKind; detail: string } | null,
  now: Date = new Date(),
): Note {
  const { report: _old, ...rest } = note
  if (report === null) return { ...rest, updatedAt: iso(now) }
  return { ...rest, report: { kind: report.kind, detail: report.detail.trim(), at: iso(now) }, updatedAt: iso(now) }
}

/** 신고가 있는 Note만, 최근 신고부터 */
export function reportedNotes(notes: readonly Note[]): (Note & { report: QuestionReport })[] {
  return notes
    .filter((n): n is Note & { report: QuestionReport } => n.report !== undefined)
    .sort((a, b) => (a.report.at < b.report.at ? 1 : a.report.at > b.report.at ? -1 : 0))
}

/** "이제 안다"가 지금도 유효한지 — 그 뒤에 다시 틀린 기록(lastWrongAt)이 있으면 무효 */
export function isMasteredAfter(note: Note | undefined, lastWrongAt: IsoDateTime): boolean {
  if (!note?.mastered) return false
  return (note.masteredAt ?? note.updatedAt) >= lastWrongAt
}
