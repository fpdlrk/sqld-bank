/**
 * 오답노트 상태 바꾸기 (T6-2) — 메모·북마크·"이제 안다"
 * 모두 새 Note를 돌려주는 순수 함수. 저장은 화면 쪽에서 storage.putNote로 한다.
 */
import type { IsoDateTime, Note, QuestionRef } from './types'

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

/** "이제 안다"가 지금도 유효한지 — 그 뒤에 다시 틀린 기록(lastWrongAt)이 있으면 무효 */
export function isMasteredAfter(note: Note | undefined, lastWrongAt: IsoDateTime): boolean {
  if (!note?.mastered) return false
  return (note.masteredAt ?? note.updatedAt) >= lastWrongAt
}
