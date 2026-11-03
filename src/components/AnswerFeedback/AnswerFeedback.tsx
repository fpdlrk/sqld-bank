import { useId, useState } from 'react'
import { CHOICE_MARKS, remapChoiceMarks, type AnyQuestion, type ChoiceNumber } from '../../domain'
import { Markdown } from '../Markdown/Markdown'
import styles from './AnswerFeedback.module.css'

interface Props {
  question: AnyQuestion
  /** 고른 보기의 원래 번호 (안 골랐으면 null) */
  chosen: ChoiceNumber | null
  /** 화면에 보인 보기 순서 — 정답을 "보이는 위치" 기호로 알려 주기 위해 */
  order?: readonly ChoiceNumber[]
  /** 이 문제에 쓴 시간(초) */
  elapsedSec?: number
  /** 해설을 처음부터 펼쳐 둘지 (기본: 펼침) */
  defaultOpen?: boolean
}

/** 채점 결과 + 해설 + 시험 포인트 (T3-2) */
export function AnswerFeedback({ question: q, chosen, order = [1, 2, 3, 4], elapsedSec, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const correct = chosen !== null && chosen === q.answer
  const position = order.indexOf(q.answer) + 1
  const answerMark = CHOICE_MARKS[(position > 0 ? position : q.answer) as ChoiceNumber]

  return (
    <section className={styles.feedback} aria-label="채점 결과">
      <p className={`${styles.result} ${correct ? styles.ok : styles.ng}`} role="status">
        <strong>{correct ? '정답입니다' : chosen === null ? '답을 고르지 않았습니다' : '오답입니다'}</strong>
        {!correct && <span> — 정답은 {answerMark}</span>}
        {elapsedSec !== undefined && <span className={styles.time}>{formatSeconds(elapsedSec)}</span>}
      </p>

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '해설 접기 ▲' : '해설 보기 ▼'}
      </button>

      <div id={bodyId} className={styles.body} hidden={!open}>
        {/* 해설은 원래 번호로 쓰여 있으므로 화면 번호로 바꿔 보여 준다 (T3-5) */}
        <Markdown source={remapChoiceMarks(q.explanation, order)} />
        <p className={styles.point}>
          <span className={styles.pointLabel}>시험 포인트</span>
          {remapChoiceMarks(q.examPoint, order)}
        </p>
      </div>
    </section>
  )
}

/** 75 → "1분 15초", 8 → "8초" */
export function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}
