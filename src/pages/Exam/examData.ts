import { submitExam, type AnyQuestion, type ExamGrade, type QuestionRef, type Session } from '../../domain'
import { getStorage } from '../../storage'
import { loadAllQuestions, loadSessionQuestions } from '../Practice/loadQuestions'

export interface LoadedExam {
  session: Session
  questionsByRef: Map<QuestionRef, AnyQuestion>
}

/** 모의고사 회차 + 그 문제들 (변형 문제는 같은 시드로 다시 만든다). 없거나 모의고사가 아니면 undefined */
export async function loadExam(sessionId: string): Promise<LoadedExam | undefined> {
  const [session, fixed] = await Promise.all([getStorage().getSession(sessionId), loadAllQuestions()])
  if (!session || session.mode !== 'exam') return undefined
  return { session, questionsByRef: await loadSessionQuestions(session.questionRefs, fixed) }
}

/**
 * 제출: 채점 → 회차 저장 → 문항별 풀이 기록 저장 (T5-3)
 * 이미 제출된 회차면 아무것도 하지 않는다 (시간 종료와 버튼 제출이 겹쳐도 한 번만).
 */
export async function submitAndSave(exam: LoadedExam, now: Date = new Date()): Promise<ExamGrade | undefined> {
  const storage = getStorage()
  const latest = await storage.getSession(exam.session.id)
  if (latest?.finishedAt) return undefined
  const { session, grade, attempts } = submitExam(exam.session, exam.questionsByRef, now)
  await storage.putSession(session)
  await Promise.all(attempts.map((a) => storage.addAttempt(a)))
  return grade
}
