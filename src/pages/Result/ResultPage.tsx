import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Card, DataTable, ProgressBar } from '../../components'
import {
  EXAM_RULES,
  EXAM_SUBJECTS,
  createPracticeSession,
  gradeExamSession,
  summarizeSession,
  verdictLabel,
  type AnyQuestion,
} from '../../domain'
import { getStorage } from '../../storage'
import { loadExam, type LoadedExam } from '../Exam/examData'
import { ResultQuestionList } from './ResultQuestionList'
import pageStyles from '../Page.module.css'
import styles from './Result.module.css'

type State = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; exam: LoadedExam }

/** 모의고사 결과 (T5-4) — 판정, 과목별 점수, 단원별 정답률, 문항별 정오표·해설, 오답 다시 풀기 */
export function ResultPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [retryError, setRetryError] = useState(false)

  useEffect(() => {
    let alive = true
    loadExam(sessionId)
      .then((exam) => alive && setState(exam ? { status: 'ready', exam } : { status: 'missing' }))
      .catch(() => alive && setState({ status: 'missing' }))
    return () => {
      alive = false
    }
  }, [sessionId])

  const exam = state.status === 'ready' ? state.exam : undefined
  const grade = useMemo(() => (exam ? gradeExamSession(exam.session, exam.questionsByRef) : undefined), [exam])
  const chapters = useMemo(() => (exam ? summarizeSession(exam.session, exam.questionsByRef).byChapter : []), [exam])

  if (state.status === 'loading') return <p role="status">결과를 불러오는 중…</p>
  if (!exam || !grade) {
    return (
      <div className={pageStyles.page}>
        <h1>결과</h1>
        <p>제출된 모의고사를 찾을 수 없습니다.</p>
        <Link to="/exam">모의고사 처음으로</Link>
      </div>
    )
  }

  const { session, questionsByRef } = exam
  if (!session.finishedAt) {
    return (
      <div className={pageStyles.page}>
        <h1>결과</h1>
        <p>아직 제출하지 않은 시험입니다.</p>
        <Link to={`/exam/${session.id}`}>이어 풀기</Link>
      </div>
    )
  }

  const answers = session.progress?.answers ?? {}
  // 틀리거나 안 푼 문제 (출제 순서대로)
  const wrongQuestions = session.questionRefs.flatMap((r): AnyQuestion[] => {
    const q = questionsByRef.get(r)
    return q && answers[r] !== q.answer ? [q] : []
  })
  const usedMinutes = Math.round((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 60_000)

  /** 틀리거나 안 푼 문제로 새 연습 */
  async function retryWrong() {
    const practice = createPracticeSession(wrongQuestions)
    try {
      await getStorage().putSession(practice)
      navigate(`/practice/${practice.id}`)
    } catch {
      setRetryError(true)
    }
  }

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <h1>모의고사 결과</h1>
      </header>

      <section className={`${styles.verdict} ${grade.passed ? styles.pass : styles.fail}`} aria-label="판정">
        <p className={styles.verdictTitle}>{grade.passed ? '합격' : verdictLabel(grade)}</p>
        <p className={styles.verdictScore}>
          {/* 문제은행이 모자라 덜 출제됐으면 만점도 그만큼 (50문항이면 100점) */}
          <strong>{grade.score}</strong>점 / {grade.totalCount * EXAM_RULES.pointsPerQuestion}점
        </p>
        <p className={styles.verdictMeta}>
          {grade.totalCorrect} / {grade.totalCount}문항 정답 · 걸린 시간 {usedMinutes}분
        </p>
      </section>

      <div className={styles.subjects}>
        {EXAM_SUBJECTS.map((s) => {
          const g = grade.subjects[s]
          return (
            <Card key={s} title={`${s}과목`}>
              <p className={styles.subjectScore}>
                <strong>{g.points}</strong> / {g.maxPoints}점
                <span className={g.failed ? styles.badFlag : styles.goodFlag}>{g.failed ? '과락' : '통과'}</span>
              </p>
              <ProgressBar label={`정답률 ${g.percent}%`} value={g.correct} max={g.count || 1} tone={g.failed ? 'danger' : 'success'} />
              <p className={styles.hint}>
                {g.correct} / {g.count}문항 정답 · 과락 기준 {g.cutoffPoints}점 미만
              </p>
            </Card>
          )
        })}
      </div>

      <Card title="단원별 정답률">
        <DataTable
          columns={['단원', '문항', '정답', '정답률']}
          rows={chapters.map((c) => [c.label, c.total, c.correct, `${Math.round((c.correct / c.total) * 100)}%`])}
        />
      </Card>

      <Card title="문항별 정오표">
        <ResultQuestionList session={session} questionsByRef={questionsByRef} />
      </Card>

      {retryError && (
        <p className={styles.error} role="alert">
          연습을 만들지 못했습니다.
        </p>
      )}
      <div className={styles.actions}>
        {wrongQuestions.length > 0 && (
          <Button size="lg" onClick={() => void retryWrong()}>
            틀린·안 푼 문제 {wrongQuestions.length}개 다시 풀기
          </Button>
        )}
        <Button size="lg" variant="secondary" onClick={() => navigate('/exam')}>
          새 모의고사
        </Button>
      </div>
    </div>
  )
}
