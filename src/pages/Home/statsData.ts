import {
  EXAM_DATE_KEY,
  PRACTICE_SETTINGS_KEY,
  chapterAccuracy,
  examTrend,
  isValidDateString,
  normalizePracticeSettings,
  subjectAccuracy,
  weakChapters,
  type Accuracy,
  type ChapterAccuracy,
  type ChapterCode,
  type ExamTrendPoint,
  type Session,
  type Subject,
} from '../../domain'
import { getStorage } from '../../storage'
import { loadAllQuestions, questionInfoResolver } from '../Practice/loadQuestions'

export interface Stats {
  chapters: ChapterAccuracy[]
  subjects: Record<Subject, Accuracy>
  weak: ChapterAccuracy[]
  trend: ExamTrendPoint[]
}

/** 통계 불러오기 (T6-4) */
export async function loadStats(now: Date = new Date()): Promise<Stats> {
  const storage = getStorage()
  const [questions, attempts, sessions] = await Promise.all([
    loadAllQuestions(),
    storage.listAttempts(),
    storage.listSessions({ mode: 'exam' }),
  ])
  const chapters = chapterAccuracy(attempts, questionInfoResolver(questions), { now })
  return { chapters, subjects: subjectAccuracy(chapters), weak: weakChapters(chapters), trend: examTrend(sessions) }
}

export interface Dashboard {
  stats: Stats
  /** "YYYY-MM-DD" 또는 아직 정하지 않음 */
  examDate: string | undefined
  /** 끝내지 않은 연습·복습·모의고사 (최근 것부터) */
  unfinished: Session[]
}

/** 대시보드 불러오기 (T6-5) */
export async function loadDashboard(now: Date = new Date()): Promise<Dashboard> {
  const storage = getStorage()
  const [stats, examDate, unfinished] = await Promise.all([
    loadStats(now),
    storage.getMeta<unknown>(EXAM_DATE_KEY).catch(() => undefined),
    storage.listSessions({ unfinished: true }).catch(() => []),
  ])
  return { stats, examDate: isValidDateString(examDate) ? examDate : undefined, unfinished }
}

/** 시험일 저장 (빈 값이면 지운다) */
export async function saveExamDate(date: string | undefined): Promise<void> {
  const storage = getStorage()
  if (date && isValidDateString(date)) await storage.setMeta(EXAM_DATE_KEY, date)
  else await storage.deleteMeta(EXAM_DATE_KEY)
}

/** 취약 단원 바로가기 — 연습 설정을 그 단원만 고른 상태로 저장 (나머지 설정은 유지) */
export async function presetPracticeChapter(chapter: ChapterCode): Promise<void> {
  const storage = getStorage()
  const current = normalizePracticeSettings(await storage.getMeta<unknown>(PRACTICE_SETTINGS_KEY).catch(() => undefined))
  await storage.setMeta(PRACTICE_SETTINGS_KEY, {
    ...current,
    subjects: [],
    chapters: [chapter],
    types: [],
    difficulties: [],
    progress: 'all',
  })
}
