/**
 * 오답노트 (T6-1 ~ T6-3) — docs/01 §6
 *
 * 오답 목록은 따로 저장하지 않고 풀이 기록(attempts)에서 계산한다.
 *   - 들어가는 문제: 한 번이라도 틀렸고, "이제 안다"(mastered)로 처리하지 않은 문제
 *     ("이제 안다" 뒤에 다시 틀리면 다시 들어온다)
 *   - 북마크한 문제는 항상 남긴다 (직접 남겨 두려고 표시한 것이므로)
 *   - 단계(T6-3): 마지막에 연속으로 맞힌 횟수(streak)
 *       0 = 복습 필요 → 1 = 한 번 맞힘(한 단계 아래) → 2 이상 = "이제 안다" 제안
 *     다시 틀리면 0으로 돌아간다. 목록에서 빼는 것은 "이제 안다"뿐.
 */
import { CHAPTER_CODES, chapterLabel } from './chapters'
import { isMasteredAfter } from './notes'
import type { Attempt, ChapterCode, IsoDateTime, Note, QuestionRef, Subject } from './types'

/** 이만큼 연속으로 맞히면 "이제 안다"를 제안한다 */
export const MASTER_STREAK = 2

/** 복습 한 번에 내는 최대 문항 수 */
export const REVIEW_LIMIT = 20

/** 문제 키 → 목록에 보여 줄 정보 (찾을 수 없으면 undefined → 목록에서 뺀다) */
export interface WrongNoteInfo {
  subject: Subject
  chapter: ChapterCode
  topic: string
  /** 변형 문제(템플릿)인지 */
  variant: boolean
}

export interface WrongNoteEntry extends WrongNoteInfo {
  ref: QuestionRef
  /** 틀린 횟수 (안 푼 문항 포함) */
  wrongCount: number
  /** 푼 횟수 */
  tries: number
  lastAt: IsoDateTime
  /** 가장 최근 시도가 정답인지 */
  lastCorrect: boolean
  /** 마지막에 연속으로 맞힌 횟수 (단계) */
  streak: number
  bookmarked: boolean
  memo: string
  /** '이제 안다'가 유효한지 (북마크 때문에 목록에 남은 경우에만 true일 수 있다) */
  mastered: boolean
}

export interface WrongNoteGroup {
  chapter: ChapterCode
  label: string
  entries: WrongNoteEntry[]
}

interface RefStat {
  tries: number
  wrong: number
  streak: number
  last: Attempt
  lastWrongAt: IsoDateTime | null
}

/** 문제별로 시간순 집계 — 연속 정답 수, 마지막으로 틀린 시각 */
function statsByRef(attempts: readonly Attempt[]): Map<QuestionRef, RefStat> {
  const sorted = [...attempts].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  const stats = new Map<QuestionRef, RefStat>()
  for (const a of sorted) {
    const s = stats.get(a.questionRef) ?? { tries: 0, wrong: 0, streak: 0, last: a, lastWrongAt: null }
    s.tries++
    s.last = a
    if (a.correct) s.streak++
    else {
      s.wrong++
      s.streak = 0
      s.lastWrongAt = a.at
    }
    stats.set(a.questionRef, s)
  }
  return stats
}

/** 문제별 "마지막에 연속으로 맞힌 횟수" (복습 화면의 이제 안다 제안용) */
export function correctStreaks(attempts: readonly Attempt[]): Map<QuestionRef, number> {
  return new Map([...statsByRef(attempts)].map(([ref, s]) => [ref, s.streak]))
}

export function buildWrongNote(
  attempts: readonly Attempt[],
  notes: readonly Note[],
  infoOf: (ref: QuestionRef) => WrongNoteInfo | undefined,
): WrongNoteEntry[] {
  const noteOf = new Map(notes.map((n) => [n.questionRef, n]))
  const entries: WrongNoteEntry[] = []
  for (const [ref, s] of statsByRef(attempts)) {
    const note = noteOf.get(ref)
    const bookmarked = note?.bookmarked ?? false
    // "이제 안다"는 그 뒤에 다시 틀렸을 때만 무효 (맞힌 기록은 상관없음)
    const mastered = s.lastWrongAt === null ? (note?.mastered ?? false) : isMasteredAfter(note, s.lastWrongAt)
    const inList = bookmarked || (s.wrong > 0 && !mastered)
    if (!inList) continue
    const info = infoOf(ref)
    if (!info) continue
    entries.push({
      ...info,
      ref,
      wrongCount: s.wrong,
      tries: s.tries,
      lastAt: s.last.at,
      lastCorrect: s.last.correct,
      streak: s.streak,
      bookmarked,
      memo: note?.memo ?? '',
      mastered,
    })
  }
  return entries
}

/** 단계 이름 */
export function stageLabel(streak: number): string {
  return streak === 0 ? '복습 필요' : streak < MASTER_STREAK ? `${streak}회 정답` : `${streak}회 연속 정답`
}

/** 복습할 차례: 단계 낮은 순 → 같은 단계는 오래전에 푼 순 */
const byReviewOrder = (a: WrongNoteEntry, b: WrongNoteEntry) =>
  a.streak - b.streak || (a.lastAt < b.lastAt ? -1 : a.lastAt > b.lastAt ? 1 : 0)

/** 단원별 묶음 — 단원표 순서, 묶음 안에서는 복습할 차례 순 (단계 낮은 문제가 위) */
export function groupWrongNote(entries: readonly WrongNoteEntry[]): WrongNoteGroup[] {
  const order = new Map<string, number>(CHAPTER_CODES.map((c, i) => [c, i]))
  const groups = new Map<ChapterCode, WrongNoteEntry[]>()
  for (const e of entries) groups.set(e.chapter, [...(groups.get(e.chapter) ?? []), e])
  return [...groups]
    .sort(([a], [b]) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    .map(([chapter, list]) => ({ chapter, label: chapterLabel(chapter), entries: [...list].sort(byReviewOrder) }))
}

/** 복습 모드에 낼 문제 — 이제 안다로 처리했거나 틀린 적 없는(북마크만 한) 문제는 뺀다 */
export function reviewQueue(entries: readonly WrongNoteEntry[], limit = REVIEW_LIMIT): WrongNoteEntry[] {
  return entries
    .filter((e) => !e.mastered && e.wrongCount > 0)
    .sort(byReviewOrder)
    .slice(0, limit)
}
