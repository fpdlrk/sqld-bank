import type { AnyQuestion, QuestionRef, Subject } from '../../domain'
import styles from './Exam.module.css'

interface Props {
  refs: readonly QuestionRef[]
  questionsByRef: ReadonlyMap<QuestionRef, AnyQuestion>
  answers: Readonly<Record<QuestionRef, unknown>>
  flagged: readonly QuestionRef[]
  current: number
  onGo: (index: number) => void
}

/**
 * 문항 이동 패널 (T5-3)
 * 푼 문항(채움) / 안 푼 문항(빈칸) / 표시한 문항(★) / 현재 문항(굵은 테두리).
 * 색만으로 구분하지 않도록 ★·밑줄 글자와 스크린리더용 설명을 함께 단다.
 */
export function ExamNavigator({ refs, questionsByRef, answers, flagged, current, onGo }: Props) {
  // 과목별로 묶어서 보여 준다
  const groups = new Map<Subject | 0, number[]>()
  refs.forEach((ref, i) => {
    const s = questionsByRef.get(ref)?.subject ?? 0
    groups.set(s, [...(groups.get(s) ?? []), i])
  })
  const answeredCount = refs.filter((r) => answers[r] !== undefined).length

  return (
    <nav className={styles.navigator} aria-label="문항 이동">
      <p className={styles.navSummary}>
        푼 문항 {answeredCount} / {refs.length} · 표시 {flagged.length}
      </p>
      {[...groups].map(([subject, indexes]) => (
        <div key={subject} className={styles.navGroup}>
          <p className={styles.navGroupTitle}>{subject === 0 ? '기타' : `${subject}과목`}</p>
          <ol className={styles.navGrid}>
            {indexes.map((i) => {
              const ref = refs[i] ?? ''
              const answered = answers[ref] !== undefined
              const isFlagged = flagged.includes(ref)
              const isCurrent = i === current
              const state = [answered ? '푼 문항' : '안 푼 문항', isFlagged && '표시함', isCurrent && '현재 문항'].filter(Boolean).join(', ')
              return (
                <li key={ref}>
                  <button
                    type="button"
                    className={[
                      styles.navCell,
                      answered && styles.navAnswered,
                      isFlagged && styles.navFlagged,
                      isCurrent && styles.navCurrent,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={`${i + 1}번 (${state})`}
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => onGo(i)}
                  >
                    {i + 1}
                    {isFlagged && <span aria-hidden="true">★</span>}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
      <p className={styles.legend} aria-hidden="true">
        <span className={`${styles.legendBox} ${styles.navAnswered}`} /> 푼 문항
        <span className={styles.legendBox} /> 안 푼 문항
        <span className={`${styles.legendBox} ${styles.navFlagged}`}>★</span> 표시
      </p>
    </nav>
  )
}
