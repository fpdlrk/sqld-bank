import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, DataTable } from '../../components'
import {
  createPracticeSession,
  refOf,
  summarizeSession,
  type AnyQuestion,
  type QuestionRef,
  type Session,
} from '../../domain'
import { getStorage } from '../../storage'
import pageStyles from '../Page.module.css'
import styles from './PracticeRun.module.css'

interface Props {
  session: Session
  questionsByRef: ReadonlyMap<QuestionRef, AnyQuestion>
}

/** 연습 결과 요약 (T3-4) — 정답 수, 단원별 결과, 틀린 문제 */
export function PracticeSummary({ session, questionsByRef }: Props) {
  const navigate = useNavigate()
  const [error, setError] = useState(false)
  const s = summarizeSession(session, questionsByRef)
  const wrongQuestions = s.wrongRefs.map((r) => questionsByRef.get(r)).filter((q): q is AnyQuestion => !!q)

  /** 틀린 문제만 모아 새 연습 시작 */
  async function retryWrong() {
    const next = createPracticeSession(wrongQuestions)
    try {
      await getStorage().putSession(next)
      navigate(`/practice/${next.id}`)
    } catch {
      setError(true)
    }
  }

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <h1>연습 결과</h1>
      </header>

      <Card>
        <p className={styles.score}>
          {s.answered}문제 중 {s.correct}개 정답 ({s.rate}%)
        </p>
        <p className={styles.scoreSub}>
          출제 {s.total}문제
          {s.total > s.answered && ` · 안 푼 문제 ${s.total - s.answered}개는 결과에서 뺐습니다`}
        </p>
      </Card>

      <Card title="단원별 결과">
        <DataTable
          columns={['단원', '푼 문제', '정답', '정답률']}
          rows={s.byChapter.map((c) => [
            c.label,
            c.answered,
            c.correct,
            c.answered === 0 ? '-' : `${Math.round((c.correct / c.answered) * 100)}%`,
          ])}
        />
      </Card>

      {wrongQuestions.length > 0 && (
        <Card title={`틀린 문제 ${wrongQuestions.length}개`}>
          <ol className={styles.wrongList}>
            {wrongQuestions.map((q) => (
              <li key={refOf(q)}>
                {q.chapter} · {q.topic}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {error && (
        <p className={styles.warn} role="alert">
          새 연습을 저장하지 못했습니다.
        </p>
      )}
      <div className={styles.actions}>
        {wrongQuestions.length > 0 && (
          <Button size="lg" onClick={() => void retryWrong()}>
            틀린 문제 다시 풀기
          </Button>
        )}
        <Button size="lg" variant="secondary" onClick={() => navigate('/practice')}>
          새 연습 설정
        </Button>
      </div>
    </div>
  )
}
