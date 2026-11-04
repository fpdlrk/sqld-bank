import { useState } from 'react'
import { Badge, Button, Markdown, QuestionView } from '../../components'
import { MASTER_STREAK, stageLabel, setBookmark, setMastered, setMemo, type AnyQuestion, type Question, type WrongNoteEntry } from '../../domain'
import { MemoEditor } from './MemoEditor'
import { formatDay, loadQuestion, updateNote } from './wrongNoteData'
import styles from './WrongNote.module.css'

interface Props {
  entry: WrongNoteEntry
  questions: readonly Question[]
  /** 북마크·메모가 바뀌었을 때 */
  onChange: (entry: WrongNoteEntry) => void
  /** "이제 안다" 처리 */
  onMastered: (entry: WrongNoteEntry) => void
}

type Detail = { status: 'closed' } | { status: 'loading' } | { status: 'open'; question: AnyQuestion | undefined }

/** 오답노트 문제 한 줄 (T6-1) + 북마크·자세히·메모·이제 안다 (T6-2) */
export function WrongNoteItem({ entry: e, questions, onChange, onMastered }: Props) {
  const [detail, setDetail] = useState<Detail>({ status: 'closed' })
  const [error, setError] = useState(false)

  async function toggleBookmark() {
    try {
      const note = await updateNote(e.ref, (n) => setBookmark(n, !e.bookmarked))
      onChange({ ...e, bookmarked: note.bookmarked })
    } catch {
      setError(true)
    }
  }

  async function master() {
    try {
      await updateNote(e.ref, (n) => setMastered(n, true))
      onMastered(e)
    } catch {
      setError(true)
    }
  }

  async function toggleDetail() {
    if (detail.status !== 'closed') return setDetail({ status: 'closed' })
    setDetail({ status: 'loading' })
    const question = await loadQuestion(e.ref, questions).catch(() => undefined)
    setDetail({ status: 'open', question })
  }

  const open = detail.status !== 'closed'
  return (
    <li className={styles.entry}>
      <div className={styles.entryMain}>
        <span className={styles.topic}>{e.topic}</span>
        <span className={styles.badges}>
          {e.bookmarked && <Badge tone="warning">★ 북마크</Badge>}
          {e.variant && <Badge tone="info">변형 문제</Badge>}
          {e.mastered ? (
            <Badge tone="success">이제 안다</Badge>
          ) : (
            e.wrongCount > 0 && <Badge tone={e.streak === 0 ? 'danger' : 'success'}>{stageLabel(e.streak)}</Badge>
          )}
        </span>
      </div>
      <p className={styles.meta}>
        틀림 {e.wrongCount}회 / 풀이 {e.tries}회 · 마지막 풀이 {formatDay(e.lastAt)}
        {e.memo && !open && <span className={styles.memoPreview}> · 메모: {e.memo}</span>}
      </p>

      <div className={styles.actions}>
        <Button variant="ghost" aria-pressed={e.bookmarked} onClick={() => void toggleBookmark()}>
          {e.bookmarked ? '★ 북마크 해제' : '☆ 북마크'}
        </Button>
        <Button variant="ghost" aria-expanded={open} onClick={() => void toggleDetail()}>
          {open ? '접기 ▲' : '자세히 ▼'}
        </Button>
        {!e.mastered && e.wrongCount > 0 && (
          // 2회 연속 맞힌 문제는 "이제 안다"를 눈에 띄게 제안
          <Button variant={e.streak >= MASTER_STREAK ? 'primary' : 'secondary'} onClick={() => void master()}>
            이제 안다
          </Button>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          저장하지 못했습니다.
        </p>
      )}

      {detail.status === 'loading' && <p role="status">문제를 불러오는 중…</p>}
      {detail.status === 'open' && (
        <div className={styles.detail}>
          {detail.question ? (
            <>
              {/* 오답노트에서는 보기를 원래 순서로 보여 주므로 해설 번호를 바꿀 필요가 없다 */}
              <QuestionView question={detail.question} answer={detail.question.answer} />
              <Markdown source={detail.question.explanation} />
              <p className={styles.point}>시험 포인트 · {detail.question.examPoint}</p>
            </>
          ) : (
            <p>문제를 찾을 수 없습니다.</p>
          )}
          <MemoEditor
            initial={e.memo}
            onSave={async (memo) => {
              await updateNote(e.ref, (n) => setMemo(n, memo))
              onChange({ ...e, memo })
            }}
          />
        </div>
      )}
    </li>
  )
}
