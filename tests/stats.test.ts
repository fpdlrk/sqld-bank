import { describe, it, expect, afterEach } from 'vitest'
import {
  chapterAccuracy,
  createExamSession,
  examTrend,
  recentAttempts,
  subjectAccuracy,
  weakChapters,
  type Attempt,
  type ChapterAccuracy,
  type ChapterCode,
  type ChapterOf,
  type Session,
} from '../src/domain'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import { createIndexedDbStorage, setStorage } from '../src/storage'
import { loadStats } from '../src/pages/Home/statsData'

const NOW = new Date('2026-11-30T12:00:00.000Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

let k = 0
const attempt = (ref: string, correct: boolean, at: string): Attempt => ({
  id: `a${++k}`,
  questionRef: ref,
  sessionId: 's',
  mode: 'practice',
  chosen: 1,
  correct,
  elapsedSec: 10,
  at,
})
/** "S1-05:3" → 단원 S1-05 (문제 키 앞부분이 단원) */
const chapterOf: ChapterOf = (ref) => {
  const ch = ref.slice(0, 5) as ChapterCode
  if (ref.startsWith('XX')) return undefined
  return { subject: ch.startsWith('M') ? 1 : 2, chapter: ch }
}
const many = (ref: string, correct: number, wrong: number, at = daysAgo(1)) => [
  ...Array.from({ length: correct }, () => attempt(ref, true, at)),
  ...Array.from({ length: wrong }, () => attempt(ref, false, at)),
]

describe('T6-4 단원별·과목별 정답률 (최근 30일)', () => {
  it('30일 안의 기록만 센다', () => {
    const list = [attempt('S1-05:1', true, daysAgo(29)), attempt('S1-05:1', true, daysAgo(31))]
    expect(recentAttempts(list, { now: NOW })).toHaveLength(1)
  })

  it('단원별: 푼 횟수·맞힌 횟수·정답률, 단원표 순서, 찾을 수 없는 문제는 뺀다', () => {
    const chapters = chapterAccuracy(
      [...many('S1-05:1', 2, 1), ...many('M1-01:1', 1, 3), ...many('XX-00:1', 5, 0), attempt('S1-03:1', true, daysAgo(40))],
      chapterOf,
      { now: NOW },
    )
    expect(chapters.map((c) => [c.chapter, c.attempts, c.correct, c.rate])).toEqual([
      ['M1-01', 4, 1, 25],
      ['S1-05', 3, 2, 67],
    ])
    expect(chapters[1]?.label).toBe('S1-05 GROUP BY, HAVING절')
  })

  it('과목별: 단원 결과를 합친다, 푼 문제가 없으면 0%', () => {
    const subjects = subjectAccuracy(chapterAccuracy([...many('S1-05:1', 3, 1), ...many('S2-01:1', 1, 3)], chapterOf, { now: NOW }))
    expect(subjects[2]).toEqual({ attempts: 8, correct: 4, rate: 50 })
    expect(subjects[1]).toEqual({ attempts: 0, correct: 0, rate: 0 })
  })
})

describe('T6-4 취약 단원 Top 3', () => {
  const ch = (chapter: ChapterCode, attempts: number, correct: number): ChapterAccuracy => ({
    chapter,
    subject: 2,
    label: chapter,
    attempts,
    correct,
    rate: Math.round((correct / attempts) * 100),
  })

  it('5회 이상 푼 단원 중 정답률 낮은 순 3개, 같으면 많이 푼 단원 먼저', () => {
    const weak = weakChapters([
      ch('S1-01', 4, 0), // 4회 → 제외
      ch('S1-02', 10, 5), // 50%
      ch('S1-03', 5, 1), // 20%
      ch('S1-04', 6, 3), // 50% (덜 풀었음)
      ch('S1-05', 8, 6), // 75%
      ch('S1-06', 5, 2), // 40%
    ])
    expect(weak.map((c) => c.chapter)).toEqual(['S1-03', 'S1-06', 'S1-02'])
  })

  it('조건을 만족하는 단원이 없으면 빈 목록', () => {
    expect(weakChapters([ch('S1-01', 4, 0)])).toEqual([])
  })
})

describe('T6-4 모의고사 점수 추이', () => {
  const exam = (finishedAt: string | null, s1: number, s2: number, passed: boolean, count = 50): Session => ({
    ...createExamSession(BUILT_IN_QUESTIONS.slice(0, 1)),
    questionRefs: Array.from({ length: count }, (_, i) => `q${i}`),
    finishedAt,
    subjectScores: { 1: s1, 2: s2 },
    passed,
  })

  it('제출한 시험만 오래된 순으로, 점수·만점·백분율·합격', () => {
    const trend = examTrend([
      exam('2026-11-20T00:00:00Z', 16, 56, true),
      exam(null, 0, 0, false), // 제출 안 함 → 제외
      exam('2026-11-10T00:00:00Z', 10, 40, false),
      exam('2026-11-15T00:00:00Z', 8, 30, false, 44), // 덜 출제됨 → 만점 88
      { ...exam('2026-11-12T00:00:00Z', 20, 80, true), mode: 'practice' }, // 연습 → 제외
    ])
    expect(trend.map((t) => [t.at, t.score, t.maxScore, t.percent, t.passed])).toEqual([
      ['2026-11-10T00:00:00Z', 50, 100, 50, false],
      ['2026-11-15T00:00:00Z', 38, 88, 43, false],
      ['2026-11-20T00:00:00Z', 72, 100, 72, true],
    ])
  })
})

describe('T6-4 저장소에서 통계 불러오기', () => {
  afterEach(() => setStorage(undefined))

  it('고정 문제·변형 문제의 기록을 단원별로 모은다', async () => {
    const storage = createIndexedDbStorage('stats-load')
    for (const a of [
      ...many('S1-05-0001', 1, 1),
      ...many('TP03#5', 3, 1), // TP03 = S1-05
      ...many('M1-01-0001', 0, 2),
      attempt('없는-문제', false, daysAgo(1)),
    ])
      await storage.addAttempt(a)
    setStorage(storage)
    const stats = await loadStats(NOW)
    expect(stats.chapters.map((c) => [c.chapter, c.attempts, c.correct])).toEqual([
      ['M1-01', 2, 0],
      ['S1-05', 6, 4],
    ])
    expect(stats.weak.map((c) => c.chapter)).toEqual(['S1-05']) // M1-01은 2회라 제외
    expect(stats.trend).toEqual([])
  })
})
