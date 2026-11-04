/**
 * 모의고사 회차 다루기 (T5-3)
 * 연습 회차(session.ts)와 같은 Session 모양을 쓰고, 종료 시각(endsAt)과 표시(flagged)를 더 쓴다.
 * 모두 "새 객체를 돌려주는" 순수 함수 — 저장은 화면 쪽에서 storage로 한다.
 */
import { examEndsAt, gradeExam, remainingSeconds, type ExamGrade } from './examRules'
import { elapsedSeconds, newId } from './grading'
import { createPracticeSession, type CreateSessionOptions } from './session'
import type { AnyQuestion, Attempt, IsoDateTime, QuestionRef, Session } from './types'

/** 새 모의고사 회차 — 보기 순서와 종료 시각(시작 + 90분)을 이때 정해 저장한다 */
export function createExamSession(questions: readonly AnyQuestion[], options: CreateSessionOptions = {}): Session {
  const now = options.now ?? new Date()
  const base = createPracticeSession(questions, { ...options, now })
  return { ...base, mode: 'exam', progress: { ...base.progress!, endsAt: examEndsAt(now) } }
}

/** 표시하기 켜기/끄기 */
export function toggleFlag(session: Session, ref: QuestionRef): Session {
  const progress = session.progress ?? { currentIndex: 0, answers: {}, flagged: [], choiceOrders: {} }
  const flagged = progress.flagged.includes(ref) ? progress.flagged.filter((r) => r !== ref) : [...progress.flagged, ref]
  return { ...session, progress: { ...progress, flagged } }
}

/** 남은 시간(초). 종료 시각이 없으면 0 */
export function examRemaining(session: Session, now: Date = new Date()): number {
  const endsAt = session.progress?.endsAt
  return endsAt ? remainingSeconds(endsAt, now) : 0
}

/** 회차의 답안으로 채점 (안 푼 문항·찾을 수 없는 문항은 오답) */
export function gradeExamSession(session: Session, questionsByRef: ReadonlyMap<QuestionRef, AnyQuestion>): ExamGrade {
  const answers = session.progress?.answers ?? {}
  return gradeExam(
    session.questionRefs.flatMap((ref) => {
      const q = questionsByRef.get(ref)
      return q ? [{ subject: q.subject, correct: answers[ref] === q.answer }] : []
    }),
  )
}

export interface ExamSubmission {
  session: Session
  grade: ExamGrade
  /** 문항마다 1건 (안 푼 문항은 chosen: null) */
  attempts: Attempt[]
}

/**
 * 제출 — 채점 결과를 회차에 적고, 문항별 풀이 기록을 만든다.
 * 모의고사는 문항별 시간을 따로 재지 않으므로 소요 시간은 "총 풀이 시간 ÷ 문항 수"로 넣는다.
 * 종료 시각을 넘겨 제출되면(시간 종료 자동 제출) 끝난 시각은 종료 시각으로 맞춘다.
 */
export function submitExam(
  session: Session,
  questionsByRef: ReadonlyMap<QuestionRef, AnyQuestion>,
  now: Date = new Date(),
): ExamSubmission {
  const grade = gradeExamSession(session, questionsByRef)
  const endsAt = session.progress?.endsAt
  const finishedMs = endsAt ? Math.min(now.getTime(), Date.parse(endsAt)) : now.getTime()
  const finishedAt = new Date(finishedMs).toISOString() as IsoDateTime
  const answers = session.progress?.answers ?? {}
  const refs = session.questionRefs.filter((r) => questionsByRef.has(r))
  const perQuestion = refs.length === 0 ? 0 : Math.round(elapsedSeconds(Date.parse(session.startedAt), finishedMs) / refs.length)

  const attempts: Attempt[] = refs.map((ref) => {
    const chosen = answers[ref] ?? null
    return {
      id: newId(),
      questionRef: ref,
      sessionId: session.id,
      mode: 'exam',
      chosen,
      correct: chosen !== null && chosen === questionsByRef.get(ref)?.answer,
      elapsedSec: perQuestion,
      at: finishedAt,
    }
  })

  return {
    session: {
      ...session,
      finishedAt,
      score: grade.totalCorrect,
      subjectScores: { 1: grade.subjects[1].points, 2: grade.subjects[2].points },
      passed: grade.passed,
    },
    grade,
    attempts,
  }
}
