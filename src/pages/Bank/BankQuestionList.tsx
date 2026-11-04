import { useState } from 'react'
import { Badge, Button, Markdown, QuestionView } from '../../components'
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS, type Question } from '../../domain'
import styles from './Bank.module.css'

/** 한 번에 보여 줄 줄 수 — 문제가 많아도 화면이 무거워지지 않게 */
export const PAGE_SIZE = 50

interface Props {
  questions: readonly Question[]
}

/** 문제 목록 (T7-1) — 줄을 누르면 미리보기(문제·정답·해설)가 펼쳐진다 */
export function BankQuestionList({ questions }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const shown = questions.slice(0, limit)

  return (
    <div className={styles.listWrap}>
      <ol className={styles.rows}>
        {shown.map((q) => {
          const isOpen = open === q.id
          return (
            <li key={q.id} className={styles.row}>
              <button
                type="button"
                className={styles.rowHead}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : q.id)}
              >
                <span className={styles.rowId}>{q.id}</span>
                <span className={styles.rowTopic}>{q.topic}</span>
                <span className={styles.rowMeta}>
                  <Badge>{QUESTION_TYPE_LABELS[q.type]}</Badge>
                  <Badge tone="warning">
                    {'★'.repeat(q.difficulty)} {DIFFICULTY_LABELS[q.difficulty]}
                  </Badge>
                  {q.source === 'user' ? <Badge tone="info">직접 추가</Badge> : <Badge tone="primary">기본</Badge>}
                </span>
              </button>
              {isOpen && (
                <div className={styles.preview}>
                  <QuestionView question={q} answer={q.answer} />
                  <Markdown source={q.explanation} />
                  <p className={styles.point}>시험 포인트 · {q.examPoint}</p>
                  {q.tags && q.tags.length > 0 && <p className={styles.point}>태그 · {q.tags.join(', ')}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {questions.length > limit && (
        <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
          더 보기 ({questions.length - limit}문제 남음)
        </Button>
      )}
    </div>
  )
}
