import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Card } from '../../components'
import { MASTER_STREAK, createReviewSession, groupWrongNote, reviewQueue, setMastered, type ChapterCode, type WrongNoteEntry } from '../../domain'
import { getStorage } from '../../storage'
import { loadSessionQuestions } from '../Practice/loadQuestions'
import { SingleChips } from '../Practice/OptionChips'
import { WrongNoteItem } from './WrongNoteItem'
import { loadWrongNote, updateNote, type LoadedWrongNote } from './wrongNoteData'
import pageStyles from '../Page.module.css'
import styles from './WrongNote.module.css'

type Filter = 'all' | 'bookmarked'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'bookmarked', label: '★ 북마크' },
]

/** 오답노트 (T6-1) — 단원별 묶음·북마크 거르기 + 메모·북마크·이제 안다 (T6-2) + 복습 시작 (T6-3) */
export function WrongNotePage() {
  const navigate = useNavigate()
  const [reviewError, setReviewError] = useState(false)
  const [data, setData] = useState<LoadedWrongNote | null>(null)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  /** 방금 "이제 안다"로 뺀 문제 — 되돌리기용 */
  const [removed, setRemoved] = useState<WrongNoteEntry | null>(null)

  useEffect(() => {
    let alive = true
    loadWrongNote()
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const entries = data?.entries
  const shown = useMemo(() => (entries ?? []).filter((e) => filter === 'all' || e.bookmarked), [entries, filter])
  const groups = useMemo(() => groupWrongNote(shown), [shown])
  const wrongCount = (entries ?? []).filter((e) => e.wrongCount > 0 && !e.mastered).length
  const reviewAll = useMemo(() => reviewQueue(entries ?? []), [entries])
  const bookmarkCount = (entries ?? []).filter((e) => e.bookmarked).length

  const replace = (next: WrongNoteEntry) =>
    setData((d) => d && { ...d, entries: d.entries.map((e) => (e.ref === next.ref ? next : e)) })

  /** "이제 안다": 북마크한 문제는 목록에 남기고 표시만, 아니면 목록에서 뺀다 */
  function onMastered(entry: WrongNoteEntry) {
    if (entry.bookmarked) return replace({ ...entry, mastered: true })
    setData((d) => d && { ...d, entries: d.entries.filter((e) => e.ref !== entry.ref) })
    setRemoved(entry)
  }

  /** 복습 시작 — 단원을 주면 그 단원만 (T6-3) */
  async function startReview(chapter?: ChapterCode) {
    if (!data) return
    const queue = reviewQueue(chapter ? data.entries.filter((e) => e.chapter === chapter) : data.entries)
    try {
      const byRef = await loadSessionQuestions(queue.map((e) => e.ref), data.questions)
      const questions = queue.flatMap((e) => {
        const q = byRef.get(e.ref)
        return q ? [q] : []
      })
      const session = createReviewSession(questions)
      const storage = getStorage()
      // 진행 중인 복습은 하나만 — 이전 복습은 버린다 (풀이 기록은 이미 저장돼 있다)
      const open = await storage.listSessions({ mode: 'review', unfinished: true })
      await Promise.all(open.map((s) => storage.deleteSession(s.id)))
      await storage.putSession(session)
      navigate(`/practice/${session.id}`)
    } catch {
      setReviewError(true)
    }
  }

  async function undo() {
    if (!removed) return
    await updateNote(removed.ref, (n) => setMastered(n, false)).catch(() => {})
    setData((d) => d && { ...d, entries: [...d.entries, removed] })
    setRemoved(null)
  }

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <h1>오답노트</h1>
        <p className={pageStyles.desc}>
          틀린 문제를 단원별로 모았습니다. 맞힐 때마다 한 단계씩 아래로 내려가고, {MASTER_STREAK}회 연속 맞히면 "이제 안다"로 뺄 수 있습니다.
        </p>
      </header>

      {failed && <p role="alert">오답노트를 불러오지 못했습니다.</p>}
      {!data && !failed && <p role="status">불러오는 중…</p>}

      {removed && (
        <p className={styles.undo} role="status">
          ‘{removed.topic}’을(를) 오답노트에서 뺐습니다.{' '}
          <Button variant="ghost" onClick={() => void undo()}>
            되돌리기
          </Button>
        </p>
      )}

      {entries && entries.length === 0 && (
        <Card>
          <p>오답노트가 비어 있습니다.</p>
          <p>
            <Link to="/practice">단원별 연습</Link>이나 <Link to="/exam">모의고사</Link>를 풀면 틀린 문제가 여기에 모입니다.
          </p>
        </Card>
      )}

      {data && entries && entries.length > 0 && (
        <>
          <div className={styles.toolbar}>
            <p className={styles.summary}>
              오답 <strong>{wrongCount}</strong>문제 · 북마크 <strong>{bookmarkCount}</strong>문제
            </p>
            <SingleChips label="오답노트 거르기" options={FILTERS} value={filter} onChange={setFilter} />
          </div>

          {reviewAll.length > 0 && (
            <Button size="lg" onClick={() => void startReview()}>
              복습 시작 ({reviewAll.length}문제)
            </Button>
          )}
          {reviewError && (
            <p className={styles.error} role="alert">
              복습을 시작하지 못했습니다.
            </p>
          )}

          {groups.length === 0 && <p className={styles.hint}>북마크한 문제가 없습니다.</p>}

          {groups.map((g) => (
            <Card
              key={g.chapter}
              title={`${g.label} (${g.entries.length})`}
              actions={
                reviewQueue(g.entries).length > 0 && (
                  <Button variant="ghost" onClick={() => void startReview(g.chapter)}>
                    이 단원 복습
                  </Button>
                )
              }
            >
              <ul className={styles.entries}>
                {g.entries.map((e) => (
                  <WrongNoteItem key={e.ref} entry={e} questions={data.questions} onChange={replace} onMastered={onMastered} />
                ))}
              </ul>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
