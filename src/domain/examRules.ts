/**
 * 모의고사 시험 규칙 (T5-1) — docs/01 §3
 *
 * ⚠ 출제 기준은 바뀔 수 있다. 시험 접수 때 데이터자격검정(dataq.or.kr) 공고를 다시 확인하고,
 *   바뀌었으면 이 파일만 고친다. (단원표 chapters.ts의 과목별 문항 수도 여기 값을 쓴다)
 */
import type { IsoDateTime, Subject } from './types'

export interface SubjectRule {
  /** 모의고사 문항 수 */
  questionCount: number
  /** 이 비율 "미만"이면 과락 (0.4 = 40%) */
  cutoffRatio: number
}

export const EXAM_RULES = {
  /** 시험 시간(분) */
  durationMinutes: 90,
  /** 남은 시간이 이 값(분) 이하가 되면 경고 */
  warningMinutes: 10,
  /** 문항당 점수 (앱 기준: 50문항 × 2점 = 100점) */
  pointsPerQuestion: 2,
  /** 합격 총점 (이상) */
  passScore: 60,
  subjects: {
    1: { questionCount: 10, cutoffRatio: 0.4 },
    2: { questionCount: 40, cutoffRatio: 0.4 },
  } satisfies Record<Subject, SubjectRule>,
} as const

export const EXAM_SUBJECTS: readonly Subject[] = [1, 2]

/** 전체 문항 수 (50) */
export const EXAM_TOTAL_QUESTIONS = EXAM_SUBJECTS.reduce((sum, s) => sum + EXAM_RULES.subjects[s].questionCount, 0)

/** 만점 (100) */
export const EXAM_MAX_SCORE = EXAM_TOTAL_QUESTIONS * EXAM_RULES.pointsPerQuestion

// ───────────────────────────── 채점 ─────────────────────────────

/** 채점할 문항 1개: 과목과 정답 여부 (안 푼 문항은 correct: false) */
export interface ExamItemResult {
  subject: Subject
  correct: boolean
}

export interface SubjectGrade {
  /** 출제 문항 수 */
  count: number
  correct: number
  /** 얻은 점수 (예: 1과목 7문항 정답 → 14점) */
  points: number
  /** 과목 만점 (예: 1과목 20점) */
  maxPoints: number
  /** 정답률 0~100 (반올림) */
  percent: number
  /** 과락 기준 점수 (이 점수 "미만"이면 과락, 예: 1과목 8점) */
  cutoffPoints: number
  /** 과락 여부 */
  failed: boolean
}

/** 합격 / 불합격(총점 미달) / 과락(과목 40% 미만 — 총점과 상관없이 불합격) */
export type ExamVerdict = 'pass' | 'fail-score' | 'fail-cutoff'

export interface ExamGrade {
  totalCorrect: number
  totalCount: number
  /** 총점 (100점 만점 기준 점수) */
  score: number
  subjects: Record<Subject, SubjectGrade>
  passed: boolean
  verdict: ExamVerdict
  /** 과락한 과목 */
  failedSubjects: Subject[]
}

/**
 * 모의고사 채점.
 * 과목 문항 수는 실제로 출제된 수를 쓴다 (문제은행이 모자라 덜 나온 경우도 비율대로 판정).
 * 과락 비교는 소수 오차를 피하려고 정수로 한다: 정답 수 × 100 < 문항 수 × 비율(%)
 */
export function gradeExam(items: readonly ExamItemResult[]): ExamGrade {
  const per = EXAM_RULES.pointsPerQuestion
  const subjects = {} as Record<Subject, SubjectGrade>

  for (const s of EXAM_SUBJECTS) {
    const mine = items.filter((i) => i.subject === s)
    const count = mine.length
    const correct = mine.filter((i) => i.correct).length
    const ratioPercent = Math.round(EXAM_RULES.subjects[s].cutoffRatio * 100)
    subjects[s] = {
      count,
      correct,
      points: correct * per,
      maxPoints: count * per,
      percent: count === 0 ? 0 : Math.round((correct / count) * 100),
      cutoffPoints: Math.ceil((count * per * ratioPercent) / 100),
      failed: count > 0 && correct * 100 < count * ratioPercent,
    }
  }

  const totalCorrect = items.filter((i) => i.correct).length
  const totalCount = items.length
  const score = totalCorrect * per
  // 덜 출제된 경우에도 "60%"라는 비율을 지키도록 만점 대비로 비교
  const passByScore = totalCount > 0 && score * EXAM_MAX_SCORE >= EXAM_RULES.passScore * (totalCount * per)
  const failedSubjects = EXAM_SUBJECTS.filter((s) => subjects[s].failed)
  const verdict: ExamVerdict = failedSubjects.length > 0 ? 'fail-cutoff' : passByScore ? 'pass' : 'fail-score'

  return { totalCorrect, totalCount, score, subjects, passed: verdict === 'pass', verdict, failedSubjects }
}

/** 판정 문구 */
export function verdictLabel(grade: ExamGrade): string {
  switch (grade.verdict) {
    case 'pass':
      return '합격'
    case 'fail-cutoff':
      return `불합격 (과락: ${grade.failedSubjects.map((s) => `${s}과목`).join(', ')})`
    default:
      return `불합격 (총점 ${EXAM_RULES.passScore}점 미만)`
  }
}

// ───────────────────────────── 시간 ─────────────────────────────

/** 시험 종료 시각 = 시작 + 90분 */
export function examEndsAt(startedAt: Date): IsoDateTime {
  return new Date(startedAt.getTime() + EXAM_RULES.durationMinutes * 60_000).toISOString()
}

/**
 * 남은 시간(초, 0 이상). 매번 "종료 시각 − 지금"으로 계산하므로
 * 새로고침·앱 전환·탭 비활성 뒤에도 정확하다.
 */
export function remainingSeconds(endsAt: IsoDateTime, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now.getTime()) / 1000))
}

/** 남은 시간 경고 구간인지 (10분 이하, 0초 제외) */
export function isWarningTime(remainingSec: number): boolean {
  return remainingSec > 0 && remainingSec <= EXAM_RULES.warningMinutes * 60
}

/** 5025 → "83:45", 59 → "00:59" */
export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
