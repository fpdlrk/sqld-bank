import {
  CHOICE_MARKS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  chapterLabel,
  isGenerated,
  type AnyQuestion,
  type ChoiceNumber,
} from '../../domain'
import { Badge } from '../Badge/Badge'
import { CodeBlock } from '../CodeBlock/CodeBlock'
import { InlineSql, looksLikeSql } from '../CodeBlock/InlineSql'
import { DataTable } from '../DataTable/DataTable'
import { Inline, Markdown } from '../Markdown/Markdown'
import styles from './QuestionView.module.css'

const ORIGINAL_ORDER: readonly ChoiceNumber[] = [1, 2, 3, 4]

interface Props {
  question: AnyQuestion
  /** 문항 번호 (예: 3 → "문제 3"). 없으면 표시 안 함 */
  number?: number
  /**
   * 보기를 보여 줄 순서 (원래 번호의 배열, 예: [3, 1, 4, 2]). 없으면 ①②③④ 그대로.
   * 화면의 ①~④는 "보이는 위치"이고, 선택·채점은 항상 원래 번호로 한다 (T3-5).
   */
  order?: readonly ChoiceNumber[]
  /** 고른 보기의 원래 번호 */
  selected?: ChoiceNumber | null
  onSelect?: (no: ChoiceNumber) => void
  /** 더 고를 수 없을 때 */
  disabled?: boolean
  /**
   * 채점 결과 표시 (T3-2) — 정답 번호를 넘기면 정답 보기는 초록, 고른 오답은 빨강으로
   * 표시하고 더 고를 수 없게 한다. 색만으로 구분하지 않도록 "정답"/"내 답" 글자도 붙인다.
   */
  answer?: ChoiceNumber
}

/**
 * 문제 한 개 표시 (T3-1): 꼬리표 → 본문 → 예시 테이블 → SQL → 보기 4개
 * 선택 상태는 부모가 가진다 (연습·모의고사가 같은 컴포넌트를 쓰도록).
 */
export function QuestionView({
  question: q,
  number,
  order = ORIGINAL_ORDER,
  selected = null,
  onSelect,
  disabled = false,
  answer,
}: Props) {
  const revealed = answer !== undefined
  return (
    <article className={styles.question} aria-label={number === undefined ? '문제' : `문제 ${number}`}>
      <header className={styles.meta}>
        {number !== undefined && <span className={styles.number}>문제 {number}</span>}
        <Badge tone="primary">{chapterLabel(q.chapter)}</Badge>
        <Badge>{QUESTION_TYPE_LABELS[q.type]}</Badge>
        <Badge tone="warning">
          {'★'.repeat(q.difficulty)} {DIFFICULTY_LABELS[q.difficulty]}
        </Badge>
        {isGenerated(q) && <Badge tone="info">변형 문제</Badge>}
      </header>

      <Markdown source={q.stem} size="lg" />

      {q.tables?.map((t, i) => <DataTable key={`${t.name ?? ''}-${i}`} name={t.name} columns={t.columns} rows={t.rows} />)}

      {q.sql && <CodeBlock code={q.sql} />}

      <ol className={styles.choices} aria-label="보기">
        {order.map((no, position) => {
          const text = q.choices[no - 1] ?? ''
          const isSelected = selected === no
          const isAnswer = revealed && no === answer
          const isWrongPick = revealed && isSelected && !isAnswer
          const stateClass = isAnswer
            ? styles.correct
            : isWrongPick
              ? styles.wrong
              : isSelected && !revealed
                ? styles.selected
                : ''
          return (
            <li key={no}>
              <button
                type="button"
                className={`${styles.choice} ${stateClass}`}
                aria-pressed={isSelected}
                disabled={disabled || revealed}
                onClick={() => onSelect?.(no)}
                data-choice-no={no}
              >
                <span className={styles.mark} aria-hidden="true">
                  {CHOICE_MARKS[(position + 1) as ChoiceNumber]}
                </span>
                <span className={styles.text}>
                  {looksLikeSql(text) ? <InlineSql code={text} /> : <Inline text={text} />}
                </span>
                {(isAnswer || isWrongPick) && (
                  <span className={styles.tag}>{isAnswer ? (isSelected ? '정답 · 내 답' : '정답') : '내 답'}</span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </article>
  )
}
