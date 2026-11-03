/**
 * 채점과 풀이 기록 만들기 (T3-2)
 * 화면과 무관한 순수 함수라서 연습·모의고사·복습이 함께 쓴다.
 */
import { refOf } from './questionRef'
import type { AnyQuestion, Attempt, ChoiceNumber, StudyMode } from './types'

/** 고른 보기(원래 번호)가 정답인지. 안 고른 문항(null)은 오답 */
export function isCorrect(question: AnyQuestion, chosen: ChoiceNumber | null): boolean {
  return chosen !== null && chosen === question.answer
}

/** 두 시각(밀리초) 사이의 초 — 반올림, 음수면 0 (기기 시계가 뒤로 바뀐 경우 대비) */
export function elapsedSeconds(startMs: number, endMs: number): number {
  return Math.max(0, Math.round((endMs - startMs) / 1000))
}

/** 기록용 고유 ID */
export function newId(): string {
  return globalThis.crypto.randomUUID()
}

export interface AttemptInput {
  question: AnyQuestion
  chosen: ChoiceNumber | null
  sessionId: string
  mode: StudyMode
  /** 문제를 화면에 띄운 시각 (Date.now()) */
  shownAtMs: number
  /** 제출한 시각 (Date.now()) */
  submittedAtMs: number
}

/** 제출 한 번 → 저장할 풀이 기록 1건 */
export function createAttempt(input: AttemptInput): Attempt {
  const { question, chosen, sessionId, mode, shownAtMs, submittedAtMs } = input
  return {
    id: newId(),
    questionRef: refOf(question),
    sessionId,
    mode,
    chosen,
    correct: isCorrect(question, chosen),
    elapsedSec: elapsedSeconds(shownAtMs, submittedAtMs),
    at: new Date(submittedAtMs).toISOString(),
  }
}
