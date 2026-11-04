/**
 * 통계 계산 (T6-4) — 대시보드(T6-5)가 쓴다
 *   - 단원별·과목별 정답률 (최근 30일)
 *   - 모의고사 점수 추이
 *   - 취약 단원 Top 3 (최근 30일 5회 이상 푼 단원 중 정답률 하위)
 * 연습·복습·모의고사 기록을 모두 센다. 모의고사에서 안 푼 문항은 오답(correct: false)으로 기록돼 있다.
 */
import { CHAPTER_CODES, chapterLabel } from './chapters'
import { EXAM_RULES } from './examRules'
import type { Attempt, ChapterCode, IsoDateTime, QuestionRef, Session, Subject } from './types'

/** 정답률 기간 (일) */
export const STATS_WINDOW_DAYS = 30
/** 취약 단원으로 볼 최소 풀이 수 */
export const WEAK_MIN_ATTEMPTS = 5
/** 취약 단원 개수 */
export const WEAK_LIMIT = 3

/** 문제 키 → 과목·단원 (찾을 수 없으면 undefined → 통계에서 뺀다) */
export type ChapterOf = (ref: QuestionRef) => { subject: Subject; chapter: ChapterCode } | undefined

export interface Accuracy {
  attempts: number
  correct: number
  /** 정답률 0~100 (반올림). 푼 문제가 없으면 0 */
  rate: number
}

export interface ChapterAccuracy extends Accuracy {
  chapter: ChapterCode
  subject: Subject
  label: string
}

export interface StatsOptions {
  now?: Date
  days?: number
}

const rateOf = (correct: number, attempts: number) => (attempts === 0 ? 0 : Math.round((correct / attempts) * 100))

/** 기간 안의 풀이 기록만 (now 기준 days일) */
export function recentAttempts(attempts: readonly Attempt[], options: StatsOptions = {}): Attempt[] {
  const { now = new Date(), days = STATS_WINDOW_DAYS } = options
  const from = new Date(now.getTime() - days * 86_400_000).toISOString()
  return attempts.filter((a) => a.at >= from)
}

/** 단원별 정답률 — 기간 안에 푼 단원만, 단원표 순서 */
export function chapterAccuracy(
  attempts: readonly Attempt[],
  chapterOf: ChapterOf,
  options: StatsOptions = {},
): ChapterAccuracy[] {
  const acc = new Map<ChapterCode, { subject: Subject; attempts: number; correct: number }>()
  for (const a of recentAttempts(attempts, options)) {
    const info = chapterOf(a.questionRef)
    if (!info) continue
    const s = acc.get(info.chapter) ?? { subject: info.subject, attempts: 0, correct: 0 }
    s.attempts++
    if (a.correct) s.correct++
    acc.set(info.chapter, s)
  }
  return CHAPTER_CODES.flatMap((chapter) => {
    const s = acc.get(chapter)
    return s ? [{ chapter, subject: s.subject, label: chapterLabel(chapter), attempts: s.attempts, correct: s.correct, rate: rateOf(s.correct, s.attempts) }] : []
  })
}

/** 과목별 정답률 (단원별 결과를 합친다) */
export function subjectAccuracy(chapters: readonly ChapterAccuracy[]): Record<Subject, Accuracy> {
  const out = {} as Record<Subject, Accuracy>
  for (const subject of [1, 2] as const) {
    const mine = chapters.filter((c) => c.subject === subject)
    const attempts = mine.reduce((s, c) => s + c.attempts, 0)
    const correct = mine.reduce((s, c) => s + c.correct, 0)
    out[subject] = { attempts, correct, rate: rateOf(correct, attempts) }
  }
  return out
}

/** 취약 단원: 최소 풀이 수 이상인 단원 중 정답률 낮은 순 (같으면 많이 푼 단원 먼저) */
export function weakChapters(
  chapters: readonly ChapterAccuracy[],
  minAttempts = WEAK_MIN_ATTEMPTS,
  limit = WEAK_LIMIT,
): ChapterAccuracy[] {
  return chapters
    .filter((c) => c.attempts >= minAttempts)
    .sort((a, b) => a.correct / a.attempts - b.correct / b.attempts || b.attempts - a.attempts)
    .slice(0, limit)
}

export interface ExamTrendPoint {
  sessionId: string
  /** 제출 시각 */
  at: IsoDateTime
  /** 총점 */
  score: number
  /** 만점 (덜 출제된 시험이면 100보다 작다) */
  maxScore: number
  /** 백분율 0~100 — 문항 수가 다른 시험끼리 비교용 */
  percent: number
  passed: boolean
  subjectScores: Record<Subject, number>
}

/** 모의고사 점수 추이 — 제출한 시험만, 오래된 순 */
export function examTrend(sessions: readonly Session[]): ExamTrendPoint[] {
  return sessions
    .filter((s): s is Session & { finishedAt: string } => s.mode === 'exam' && s.finishedAt !== null)
    .sort((a, b) => (a.finishedAt < b.finishedAt ? -1 : 1))
    .map((s) => {
      const subjectScores = s.subjectScores ?? { 1: 0, 2: 0 }
      const score = subjectScores[1] + subjectScores[2]
      const maxScore = s.questionRefs.length * EXAM_RULES.pointsPerQuestion
      return {
        sessionId: s.id,
        at: s.finishedAt,
        score,
        maxScore,
        percent: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100),
        passed: s.passed ?? false,
        subjectScores,
      }
    })
}
