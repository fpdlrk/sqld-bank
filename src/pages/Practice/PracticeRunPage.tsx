import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AnswerFeedback, Button, Modal, ProgressBar, QuestionView } from '../../components'
import {
  MASTER_STREAK,
  ORIGINAL_ORDER,
  correctStreaks,
  finishSession,
  isValidChoiceOrder,
  moveTo,
  recordAnswer,
  type AnyQuestion,
  type QuestionRef,
  type Session,
} from '../../domain'
import { getStorage } from '../../storage'
import { loadAllQuestions, loadSessionQuestions } from './loadQuestions'
import { PracticeSummary } from './PracticeSummary'
import { QuestionPlayer } from './QuestionPlayer'
import { MasterPrompt } from '../WrongNote/MasterPrompt'
import pageStyles from '../Page.module.css'
import styles from './PracticeRun.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | {
      status: 'ready'
      session: Session
      questionsByRef: Map<QuestionRef, AnyQuestion>
      /** 복습 모드: 이 회차를 시작하기 전까지의 연속 정답 수 (T6-3) */
      streaks: Map<QuestionRef, number>
    }

/**
 * 연습 풀이 화면 (T3-4) — 주소: #/practice/{회차ID}
 * 오답 복습(mode: review, T6-3)도 같은 화면을 쓴다. 복습 중 2회 연속 맞히면 "이제 안다"를 제안한다.
 * 답을 내거나 문항을 옮길 때마다 회차를 저장하므로, 새로고침해도 같은 자리에서 이어진다.
 */
export function PracticeRunPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [saveFailed, setSaveFailed] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  // 방금 이 화면에서 제출한 문제 — 채점 화면(소요 시간·저장 실패 안내 포함)을 그대로 유지하기 위해
  const [liveRef, setLiveRef] = useState<QuestionRef | null>(null)
  // 복습 중 "이제 안다"를 제안할 문제
  const [suggestRef, setSuggestRef] = useState<QuestionRef | null>(null)

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    setLiveRef(null)
    Promise.all([getStorage().getSession(sessionId), loadAllQuestions()])
      .then(async ([session, questions]) => {
        if (!session || (session.mode !== 'practice' && session.mode !== 'review')) {
          if (alive) setState({ status: 'missing' })
          return
        }
        // 변형 문제는 저장된 "템플릿ID#시드"로 다시 만든다 (T4-7)
        const questionsByRef = await loadSessionQuestions(session.questionRefs, questions)
        // 복습: 이 회차 전까지의 연속 정답 수 (이 회차에서 푼 기록은 빼고 센다)
        const streaks =
          session.mode === 'review'
            ? correctStreaks((await getStorage().listAttempts()).filter((a) => a.sessionId !== session.id))
            : new Map<QuestionRef, number>()
        if (alive) setState({ status: 'ready', session, questionsByRef, streaks })
      })
      .catch(() => alive && setState({ status: 'missing' }))
    return () => {
      alive = false
    }
  }, [sessionId])

  if (state.status === 'loading') {
    return <p role="status">문제를 준비하는 중… (변형 문제가 있으면 처음 한 번은 SQL 실행기를 불러옵니다)</p>
  }
  if (state.status === 'missing') {
    return (
      <div className={pageStyles.page}>
        <h1>연습을 찾을 수 없습니다</h1>
        <p className={pageStyles.desc}>지워졌거나 다른 기기에서 만든 연습입니다.</p>
        <Link to="/practice">연습 설정으로</Link>
      </div>
    )
  }

  const { session, questionsByRef, streaks } = state
  const isReview = session.mode === 'review'

  /** 화면 상태를 바꾸고 저장소에도 저장 */
  function save(next: Session) {
    setState({ status: 'ready', session: next, questionsByRef, streaks })
    getStorage()
      .putSession(next)
      .then(() => setSaveFailed(false))
      .catch(() => setSaveFailed(true))
  }

  if (session.finishedAt) {
    return <PracticeSummary session={session} questionsByRef={questionsByRef} />
  }

  const refs = session.questionRefs
  const total = refs.length
  const index = session.progress?.currentIndex ?? 0
  const answers = session.progress?.answers ?? {}
  const ref = refs[index] ?? ''
  const question = questionsByRef.get(ref)
  const chosen = answers[ref]
  // 회차에 저장된 보기 순서 (없거나 깨졌으면 원래 순서) — T3-5
  const savedOrder = session.progress?.choiceOrders[ref]
  const order = isValidChoiceOrder(savedOrder) ? savedOrder : ORIGINAL_ORDER
  const answeredCount = refs.filter((r) => answers[r] !== undefined).length
  const unanswered = total - answeredCount
  const isLast = index === total - 1

  /** 문항 이동 — 다른 문제로 가면 '방금 제출' 표시를 지운다 */
  const go = (i: number) => {
    setLiveRef(null)
    save(moveTo(session, i))
  }
  const finish = () => {
    setConfirmFinish(false)
    save(finishSession(session, questionsByRef))
  }
  const goNext = () => (isLast ? (unanswered > 0 ? setConfirmFinish(true) : finish()) : go(index + 1))
  const nextLabel = isLast ? '결과 보기' : '다음 문제'

  return (
    <div className={pageStyles.page}>
      <header className={styles.top}>
        <div className={styles.topRow}>
          <h1 className={styles.title}>{isReview ? '오답 복습' : '단원별 연습'}</h1>
          <Button variant="ghost" onClick={() => navigate(isReview ? '/wrong' : '/practice')}>
            그만두기
          </Button>
        </div>
        <ProgressBar label={`문제 ${index + 1} / ${total}`} value={answeredCount} max={total} />
        {saveFailed && (
          <p className={styles.warn} role="alert">
            진행 상태를 저장하지 못했습니다. 새로고침하면 이어 풀 수 없을 수 있습니다.
          </p>
        )}
      </header>

      {!question ? (
        <p className={pageStyles.todo}>이 문제({ref})를 찾을 수 없습니다. 삭제된 문제일 수 있으니 다음으로 넘어가세요.</p>
      ) : chosen === undefined || liveRef === ref ? (
        <QuestionPlayer
          question={question}
          sessionId={session.id}
          mode={session.mode}
          number={index + 1}
          order={order}
          onSubmitted={(a) => {
            if (a.chosen === null) return
            setLiveRef(ref)
            // 복습에서 맞혀 연속 정답이 기준에 닿으면 "이제 안다" 제안
            if (isReview && a.correct && (streaks.get(ref) ?? 0) + 1 >= MASTER_STREAK) setSuggestRef(ref)
            save(recordAnswer(session, ref, a.chosen))
          }}
          footer={
            <>
              {suggestRef === ref && <MasterPrompt questionRef={ref} />}
              <Button block size="lg" onClick={goNext}>
                {nextLabel}
              </Button>
            </>
          }
        />
      ) : (
        // 이미 푼 문제 (이전으로 돌아왔거나 새로고침) — 채점 결과를 그대로 보여 준다
        <div className={styles.answered}>
          <QuestionView question={question} number={index + 1} order={order} selected={chosen} answer={question.answer} />
          <AnswerFeedback question={question} chosen={chosen} order={order} />
          <Button block size="lg" onClick={goNext}>
            {nextLabel}
          </Button>
        </div>
      )}

      <nav className={styles.nav} aria-label="문항 이동">
        <Button variant="secondary" disabled={index === 0} onClick={() => go(index - 1)}>
          ◀ 이전
        </Button>
        <span className={styles.position}>
          {index + 1} / {total}
        </span>
        {isLast ? (
          <Button variant="secondary" onClick={goNext}>
            끝내기
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => go(index + 1)}>
            다음 ▶
          </Button>
        )}
      </nav>

      <Modal
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title={isReview ? '복습을 끝낼까요?' : '연습을 끝낼까요?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmFinish(false)}>
              계속 풀기
            </Button>
            <Button onClick={finish}>끝내고 결과 보기</Button>
          </>
        }
      >
        <p>아직 풀지 않은 문제가 {unanswered}개 있습니다. 안 푼 문제는 결과에서 빠집니다.</p>
      </Modal>
    </div>
  )
}
