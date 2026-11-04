import {
  EXAM_DATE_KEY,
  LAST_BACKUP_KEY,
  PRACTICE_SETTINGS_KEY,
  backupReminder,
  chapterAccuracy,
  examTrend,
  isValidDateString,
  normalizePracticeSettings,
  subjectAccuracy,
  weakChapters,
  type Accuracy,
  type Attempt,
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
export async function loadStats(now: Date = new Date(), preloaded?: Attempt[]): Promise<Stats> {
  const storage = getStorage()
  const [questions, attempts, sessions] = await Promise.all([
    loadAllQuestions(),
    preloaded ?? storage.listAttempts(),
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
  /** 백업을 권할 때: 마지막 백업(없으면 첫 기록) 후 지난 날 수 (T7-4) */
  backupDays: number | null
  /** 백업한 적이 있는지 */
  everBackedUp: boolean
}

/** 대시보드 불러오기 (T6-5) */
export async function loadDashboard(now: Date = new Date()): Promise<Dashboard> {
  const storage = getStorage()
  const attempts = await storage.listAttempts()
  const [stats, examDate, unfinished, lastBackupAt] = await Promise.all([
    loadStats(now, attempts),
    storage.getMeta<unknown>(EXAM_DATE_KEY).catch(() => undefined),
    storage.listSessions({ unfinished: true }).catch(() => []),
    storage.getMeta<unknown>(LAST_BACKUP_KEY).catch(() => undefined),
  ])
  const last = typeof lastBackupAt === 'string' ? lastBackupAt : undefined
  return {
    stats,
    examDate: isValidDateString(examDate) ? examDate : undefined,
    unfinished,
    // listAttempts는 오래된 순 → 첫 항목이 가장 오래된 기록
    backupDays: backupReminder(last, attempts[0]?.at, now),
    everBackedUp: last !== undefined,
  }
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
