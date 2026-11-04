import { useState } from 'react'
import { AnswerFeedback, QuestionView } from '../../components'
import {
  CHOICE_MARKS,
  ORIGINAL_ORDER,
  isValidChoiceOrder,
  type AnyQuestion,
  type ChoiceNumber,
  type QuestionRef,
  type Session,
} from '../../domain'
import { SingleChips } from '../Practice/OptionChips'
import { ReportIssue } from '../Practice/ReportIssue'
import styles from './Result.module.css'

type Filter = 'all' | 'wrong' | 'unanswered' | 'flagged'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'wrong', label: '오답 (틀림·안 품)' },
  { value: 'unanswered', label: '안 푼 문제' },
  { value: 'flagged', label: '표시한 문제' },
]

interface Props {
  session: Session
  questionsByRef: ReadonlyMap<QuestionRef, AnyQuestion>
}

/**
 * 문항별 정오표 (T5-4)
 * 번호는 시험 볼 때 화면에 보이던 보기 순서 기준 (섞인 보기 그대로).
 * 줄을 누르면 문제·채점 표시·해설이 펼쳐진다.
 */
export function ResultQuestionList({ session, questionsByRef }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<QuestionRef | null>(null)
  const progress = session.progress
  const answers = progress?.answers ?? {}
  const flagged = progress?.flagged ?? []

  const rows = session.questionRefs.map((ref, i) => {
    const q = questionsByRef.get(ref)
    const saved = progress?.choiceOrders[ref]
    const order = isValidChoiceOrder(saved) ? saved : ORIGINAL_ORDER
    const chosen = answers[ref] ?? null
    const correct = !!q && chosen === q.answer
    return { ref, no: i + 1, q, order, chosen, correct }
  })

  const shown = rows.filter((r) => {
    if (filter === 'wrong') return !r.correct
    if (filter === 'unanswered') return r.chosen === null
    if (filter === 'flagged') return flagged.includes(r.ref)
    return true
  })

  /** 원래 번호 → 화면에 보였던 기호 */
  const markOf = (order: readonly ChoiceNumber[], no: ChoiceNumber) => CHOICE_MARKS[(order.indexOf(no) + 1) as ChoiceNumber]

  return (
    <div className={styles.list}>
      <SingleChips label="정오표 보기" options={FILTERS} value={filter} onChange={setFilter} />
      {shown.length === 0 && <p className={styles.hint}>해당하는 문항이 없습니다.</p>}
      <ol className={styles.rows}>
        {shown.map((r) => {
          const isOpen = open === r.ref
          const status = r.chosen === null ? '미응답' : r.correct ? '정답' : '오답'
          return (
            <li key={r.ref} className={styles.row}>
              <button
                type="button"
                className={styles.rowHead}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : r.ref)}
              >
                <span className={styles.rowNo}>{r.no}</span>
                <span
                  className={`${styles.mark} ${r.chosen === null ? styles.markNone : r.correct ? styles.markOk : styles.markNg}`}
                  aria-label={status}
                >
                  {r.chosen === null ? '－' : r.correct ? '○' : '✕'}
                </span>
                <span className={styles.rowTopic}>
                  {r.q ? `${r.q.chapter} · ${r.q.topic}` : '(찾을 수 없는 문제)'}
                  {flagged.includes(r.ref) && <span aria-label="표시함"> ★</span>}
                </span>
                <span className={styles.rowAnswers}>
                  내 답 {r.chosen === null ? '없음' : markOf(r.order, r.chosen)} · 정답 {r.q ? markOf(r.order, r.q.answer) : '-'}
                </span>
              </button>
              {isOpen && r.q && (
                <div className={styles.detail}>
                  <QuestionView question={r.q} number={r.no} order={r.order} selected={r.chosen} answer={r.q.answer} />
                  <AnswerFeedback question={r.q} chosen={r.chosen} order={r.order} />
                  <ReportIssue questionRef={r.ref} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
