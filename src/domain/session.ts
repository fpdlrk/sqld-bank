/**
 * 연습 회차 다루기 (T3-4)
 * 회차(Session)에 진행 상태(progress)를 함께 저장해 두면, 새로고침·앱 전환 뒤에도 이어 풀 수 있다.
 * 모두 "새 객체를 돌려주는" 순수 함수 — 저장은 화면 쪽에서 storage로 한다.
 */
import { makeChoiceOrder } from './choiceOrder'
import { newId } from './grading'
import { chapterLabel } from './chapters'
import { refOf } from './questionRef'
import type { AnyQuestion, ChapterCode, ChoiceNumber, IsoDateTime, QuestionRef, Session } from './types'

export interface CreateSessionOptions {
  /** 보기 순서 섞기 (T3-5, 기본 true). fixedOrder 문제는 섞지 않는다 */
  shuffleChoices?: boolean
  now?: Date
  /** 테스트용 난수 */
  random?: () => number
}

/** 새 연습 회차 — 문제별 보기 순서도 이때 정해 저장한다 */
export function createPracticeSession(questions: readonly AnyQuestion[], options: CreateSessionOptions = {}): Session {
  const { shuffleChoices = true, now = new Date(), random = Math.random } = options
  const choiceOrders: Record<QuestionRef, ChoiceNumber[]> = {}
  if (shuffleChoices) {
    for (const q of questions) choiceOrders[refOf(q)] = makeChoiceOrder(q, random)
  }
  return {
    id: newId(),
    mode: 'practice',
    startedAt: now.toISOString(),
    finishedAt: null,
    questionRefs: questions.map(refOf),
    score: null,
    subjectScores: null,
    passed: null,
    progress: { currentIndex: 0, answers: {}, flagged: [], choiceOrders },
  }
}

const emptyProgress = () => ({ currentIndex: 0, answers: {}, flagged: [], choiceOrders: {} })

/** 문항 이동 — 범위를 벗어나면 처음/끝에 맞춘다 */
export function moveTo(session: Session, index: number): Session {
  const last = Math.max(0, session.questionRefs.length - 1)
  const currentIndex = Math.min(Math.max(0, index), last)
  return { ...session, progress: { ...(session.progress ?? emptyProgress()), currentIndex } }
}

/** 제출한 답 기록 */
export function recordAnswer(session: Session, ref: QuestionRef, chosen: ChoiceNumber): Session {
  const progress = session.progress ?? emptyProgress()
  return { ...session, progress: { ...progress, answers: { ...progress.answers, [ref]: chosen } } }
}

/** 회차 끝내기 — 맞힌 수를 score에 기록. 진행 상태(answers)는 요약을 다시 보기 위해 남겨 둔다 */
export function finishSession(
  session: Session,
  questionsByRef: ReadonlyMap<QuestionRef, AnyQuestion>,
  now: Date = new Date(),
): Session {
  const { correct } = summarizeSession(session, questionsByRef)
  return { ...session, finishedAt: now.toISOString() as IsoDateTime, score: correct }
}

export interface ChapterResult {
  chapter: ChapterCode
  label: string
  total: number
  answered: number
  correct: number
}

export interface SessionSummary {
  total: number
  answered: number
  correct: number
  /** 맞힌 비율(0~100, 반올림). 푼 문제가 없으면 0 */
  rate: number
  /** 단원 순서대로 */
  byChapter: ChapterResult[]
  /** 틀린 문제의 키 (출제 순서대로) */
  wrongRefs: QuestionRef[]
}

/** 회차 요약 — 정답 수·단원별 결과. 문제를 찾을 수 없는 키(지워진 문제 등)는 건너뛴다 */
export function summarizeSession(
  session: Session,
  questionsByRef: ReadonlyMap<QuestionRef, AnyQuestion>,
): SessionSummary {
  const answers = session.progress?.answers ?? {}
  const chapters = new Map<ChapterCode, ChapterResult>()
  const wrongRefs: QuestionRef[] = []
  let total = 0
  let answered = 0
  let correct = 0

  for (const ref of session.questionRefs) {
    const q = questionsByRef.get(ref)
    if (!q) continue
    total++
    const row =
      chapters.get(q.chapter) ??
      chapters.set(q.chapter, { chapter: q.chapter, label: chapterLabel(q.chapter), total: 0, answered: 0, correct: 0 }).get(q.chapter)!
    row.total++
    const chosen = answers[ref]
    if (chosen === undefined) continue
    answered++
    row.answered++
    if (chosen === q.answer) {
      correct++
      row.correct++
    } else {
      wrongRefs.push(ref)
    }
  }

  return {
    total,
    answered,
    correct,
    rate: answered === 0 ? 0 : Math.round((correct / answered) * 100),
    byChapter: [...chapters.values()].sort((a, b) => (a.chapter < b.chapter ? -1 : 1)),
    wrongRefs,
  }
}

/** 오답 복습 회차 (T6-3) — 연습 회차와 같고 모드만 'review' */
export function createReviewSession(questions: readonly AnyQuestion[], options: CreateSessionOptions = {}): Session {
  return { ...createPracticeSession(questions, options), mode: 'review' }
}
