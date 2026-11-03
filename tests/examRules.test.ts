import { describe, it, expect } from 'vitest'
import {
  EXAM_MAX_SCORE,
  EXAM_RULES,
  EXAM_TOTAL_QUESTIONS,
  SUBJECTS,
  examEndsAt,
  formatClock,
  gradeExam,
  isWarningTime,
  remainingSeconds,
  verdictLabel,
  type ExamItemResult,
} from '../src/domain'

/** 1과목 a문항, 2과목 b문항 정답인 50문항 시험 결과 */
function exam(a: number, b: number): ExamItemResult[] {
  return [
    ...Array.from({ length: 10 }, (_, i) => ({ subject: 1 as const, correct: i < a })),
    ...Array.from({ length: 40 }, (_, i) => ({ subject: 2 as const, correct: i < b })),
  ]
}

describe('T5-1 시험 규칙 값 (docs/01 §3)', () => {
  it('50문항(10/40)·90분·문항당 2점·100점 만점·60점 합격·과락 40%', () => {
    expect(EXAM_TOTAL_QUESTIONS).toBe(50)
    expect(EXAM_RULES.subjects[1].questionCount).toBe(10)
    expect(EXAM_RULES.subjects[2].questionCount).toBe(40)
    expect(EXAM_RULES.durationMinutes).toBe(90)
    expect(EXAM_MAX_SCORE).toBe(100)
    expect(EXAM_RULES.passScore).toBe(60)
    expect(EXAM_RULES.subjects[1].cutoffRatio).toBe(0.4)
  })

  it('단원표의 과목별 문항 수가 시험 규칙과 같다 (한 곳에서 관리)', () => {
    expect(SUBJECTS.map((s) => s.examCount)).toEqual([10, 40])
  })
})

describe('T5-1 채점', () => {
  it('총점·과목별 점수·정답률', () => {
    const g = gradeExam(exam(7, 30))
    expect(g).toMatchObject({ totalCorrect: 37, totalCount: 50, score: 74, passed: true, verdict: 'pass' })
    expect(g.subjects[1]).toMatchObject({ count: 10, correct: 7, points: 14, maxPoints: 20, percent: 70, cutoffPoints: 8, failed: false })
    expect(g.subjects[2]).toMatchObject({ count: 40, correct: 30, points: 60, maxPoints: 80, percent: 75, cutoffPoints: 32, failed: false })
    expect(verdictLabel(g)).toBe('합격')
  })

  it('합격 경계: 60점(30문항)은 합격, 58점은 불합격', () => {
    expect(gradeExam(exam(5, 25)).verdict).toBe('pass') // 60점
    const g = gradeExam(exam(5, 24)) // 58점
    expect(g.verdict).toBe('fail-score')
    expect(verdictLabel(g)).toBe('불합격 (총점 60점 미만)')
  })

  it('과락 경계: 1과목 4문항(8점)은 통과, 3문항(6점)은 과락', () => {
    expect(gradeExam(exam(4, 40)).subjects[1].failed).toBe(false)
    const g = gradeExam(exam(3, 40)) // 총점 86점이지만 1과목 과락
    expect(g.score).toBe(86)
    expect(g.verdict).toBe('fail-cutoff')
    expect(g.passed).toBe(false)
    expect(verdictLabel(g)).toBe('불합격 (과락: 1과목)')
  })

  it('과락 경계: 2과목 16문항(32점)은 통과, 15문항은 과락', () => {
    expect(gradeExam(exam(10, 16)).subjects[2].failed).toBe(false)
    expect(gradeExam(exam(10, 15)).failedSubjects).toEqual([2])
  })

  it('두 과목 모두 과락이면 둘 다 표시', () => {
    expect(verdictLabel(gradeExam(exam(0, 0)))).toBe('불합격 (과락: 1과목, 2과목)')
  })

  it('안 푼 문항은 오답(correct: false)으로 넘기면 된다', () => {
    expect(gradeExam([{ subject: 1, correct: false }]).totalCorrect).toBe(0)
  })

  it('문항이 덜 출제된 경우에도 비율로 판정', () => {
    // 1과목 5문항 중 2개(40%) → 통과, 2과목 20문항 중 12개 → 총 14/25 = 56% → 총점 미달
    const items = [
      ...Array.from({ length: 5 }, (_, i) => ({ subject: 1 as const, correct: i < 2 })),
      ...Array.from({ length: 20 }, (_, i) => ({ subject: 2 as const, correct: i < 12 })),
    ]
    const g = gradeExam(items)
    expect(g.subjects[1].failed).toBe(false)
    expect(g.verdict).toBe('fail-score')
    expect(gradeExam([]).passed).toBe(false)
  })
})

describe('T5-1 시간', () => {
  const start = new Date('2026-11-03T10:00:00.000Z')

  it('종료 시각 = 시작 + 90분', () => {
    expect(examEndsAt(start)).toBe('2026-11-03T11:30:00.000Z')
  })

  it('남은 시간은 "종료 시각 − 지금" (초 단위 올림, 0 아래로 안 내려감)', () => {
    const end = examEndsAt(start)
    expect(remainingSeconds(end, start)).toBe(5400)
    expect(remainingSeconds(end, new Date('2026-11-03T11:29:59.200Z'))).toBe(1)
    expect(remainingSeconds(end, new Date('2026-11-03T12:00:00.000Z'))).toBe(0)
  })

  it('남은 10분 이하는 경고 구간', () => {
    expect(isWarningTime(601)).toBe(false)
    expect(isWarningTime(600)).toBe(true)
    expect(isWarningTime(1)).toBe(true)
    expect(isWarningTime(0)).toBe(false)
  })

  it('시계 표시', () => {
    expect(formatClock(5400)).toBe('90:00')
    expect(formatClock(5025)).toBe('83:45')
    expect(formatClock(59)).toBe('00:59')
  })
})
