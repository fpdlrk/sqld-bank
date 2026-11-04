import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Button, Modal, QuestionView } from '../../components'
import {
  ORIGINAL_ORDER,
  examRemaining,
  formatClock,
  isValidChoiceOrder,
  isWarningTime,
  moveTo,
  recordAnswer,
  toggleFlag,
  type Session,
} from '../../domain'
import { getStorage } from '../../storage'
import { ExamNavigator } from './ExamNavigator'
import { loadExam, submitAndSave, type LoadedExam } from './examData'
import pageStyles from '../Page.module.css'
import styles from './Exam.module.css'

type State = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; exam: LoadedExam }

/**
 * 모의고사 시험 화면 (T5-3) — 주소: #/exam/{회차ID}
 * - 답·표시·문항 이동을 할 때마다 회차를 저장 → 새로고침·앱 전환 뒤에도 그대로
 * - 남은 시간은 매초 "종료 시각 − 지금"으로 다시 계산 → 시간도 그대로
 * - 시간이 다 되면(앱을 꺼 둔 사이 지났어도) 자동 제출
 */
export function ExamRunPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [now, setNow] = useState(() => Date.now())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    let alive = true
    loadExam(sessionId)
      .then((exam) => alive && setState(exam ? { status: 'ready', exam } : { status: 'missing' }))
      .catch(() => alive && setState({ status: 'missing' }))
    return () => {
      alive = false
    }
  }, [sessionId])

  // 1초마다 시계 갱신 (남은 시간은 매번 종료 시각으로 다시 계산하므로 setInterval이 밀려도 정확)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const exam = state.status === 'ready' ? state.exam : undefined
  const remaining = exam ? examRemaining(exam.session, new Date(now)) : 0

  const submit = useCallback(async () => {
    if (!exam || submitting.current) return
    submitting.current = true
    setConfirmOpen(false)
    try {
      await submitAndSave(exam)
      navigate(`/result/${exam.session.id}`, { replace: true })
    } catch {
      submitting.current = false
      setSubmitError(true)
    }
  }, [exam, navigate])

  // 시간 종료 → 자동 제출
  useEffect(() => {
    if (exam && !exam.session.finishedAt && remaining === 0) void submit()
  }, [exam, remaining, submit])

  if (state.status === 'loading') return <p role="status">시험을 준비하는 중…</p>
  if (state.status === 'missing' || !exam) {
    return (
      <div className={pageStyles.page}>
        <h1>시험을 찾을 수 없습니다</h1>
        <Link to="/exam">모의고사 처음으로</Link>
      </div>
    )
  }
  if (exam.session.finishedAt) return <Navigate to={`/result/${exam.session.id}`} replace />

  const { session, questionsByRef } = exam
  const progress = session.progress ?? { currentIndex: 0, answers: {}, flagged: [], choiceOrders: {} }
  const refs = session.questionRefs
  const total = refs.length
  const index = progress.currentIndex
  const ref = refs[index] ?? ''
  const question = questionsByRef.get(ref)
  const savedOrder = progress.choiceOrders[ref]
  const order = isValidChoiceOrder(savedOrder) ? savedOrder : ORIGINAL_ORDER
  const unanswered = refs.filter((r) => progress.answers[r] === undefined).length
  const flagged = progress.flagged.includes(ref)
  const warning = isWarningTime(remaining)

  function save(next: Session) {
    setState({ status: 'ready', exam: { session: next, questionsByRef } })
    getStorage()
      .putSession(next)
      .then(() => setSaveFailed(false))
      .catch(() => setSaveFailed(true))
  }
  const go = (i: number) => {
    save(moveTo(session, i))
    setPanelOpen(false)
  }

  return (
    <div className={styles.exam}>
      <header className={styles.bar}>
        <h1 className={styles.barTitle}>모의고사</h1>
        <p className={`${styles.timer} ${warning ? styles.timerWarn : ''}`} aria-label={`남은 시간 ${formatClock(remaining)}`}>
          ⏱ <span data-testid="exam-timer">{formatClock(remaining)}</span>
        </p>
        <Button variant="secondary" className={styles.panelToggle} aria-expanded={panelOpen} onClick={() => setPanelOpen((v) => !v)}>
          문항 {index + 1}/{total}
        </Button>
        <Button onClick={() => setConfirmOpen(true)}>제출</Button>
      </header>

      {warning && (
        <p className={styles.warnBanner} role="alert">
          남은 시간이 {EXAM_WARNING_TEXT}입니다. 시간이 끝나면 자동으로 제출됩니다.
        </p>
      )}
      {(saveFailed || submitError) && (
        <p className={styles.warnBanner} role="alert">
          {submitError ? '제출을 저장하지 못했습니다. 다시 [제출]을 눌러 주세요.' : '답안을 저장하지 못했습니다. 새로고침하면 답이 사라질 수 있습니다.'}
        </p>
      )}

      <div className={styles.layout}>
        <section className={styles.main} aria-label="문제">
          {question ? (
            <QuestionView
              question={question}
              number={index + 1}
              order={order}
              selected={progress.answers[ref] ?? null}
              onSelect={(no) => save(recordAnswer(session, ref, no))}
            />
          ) : (
            <p className={pageStyles.todo}>이 문제({ref})를 찾을 수 없습니다. 오답으로 처리됩니다.</p>
          )}

          <div className={styles.questionNav}>
            <Button variant="secondary" disabled={index === 0} onClick={() => go(index - 1)}>
              ◀ 이전
            </Button>
            <Button variant="ghost" aria-pressed={flagged} onClick={() => save(toggleFlag(session, ref))}>
              {flagged ? '★ 표시함' : '☆ 표시하기'}
            </Button>
            {index < total - 1 ? (
              <Button variant="secondary" onClick={() => go(index + 1)}>
                다음 ▶
              </Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)}>제출</Button>
            )}
          </div>
        </section>

        <aside className={`${styles.side} ${panelOpen ? styles.sideOpen : ''}`}>
          <ExamNavigator
            refs={refs}
            questionsByRef={questionsByRef}
            answers={progress.answers}
            flagged={progress.flagged}
            current={index}
            onGo={go}
          />
        </aside>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="시험을 제출할까요?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              계속 풀기
            </Button>
            <Button onClick={() => void submit()}>제출</Button>
          </>
        }
      >
        <p>
          {unanswered > 0 ? (
            <>
              아직 풀지 않은 문항이 <strong>{unanswered}개</strong> 있습니다. 안 푼 문항은 오답으로 처리됩니다.
            </>
          ) : (
            '모든 문항에 답했습니다.'
          )}
          {progress.flagged.length > 0 && ` 표시한 문항이 ${progress.flagged.length}개 있습니다.`}
        </p>
        <p>제출하면 답을 바꿀 수 없습니다. (남은 시간 {formatClock(remaining)})</p>
      </Modal>
    </div>
  )
}

const EXAM_WARNING_TEXT = '10분 이하'
