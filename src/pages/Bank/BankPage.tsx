import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Modal } from '../../components'
import { BUILT_IN_QUESTIONS } from '../../data/builtInQuestions'
import {
  CHAPTERS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  buildQuestionsFile,
  chapterLabel,
  fileDate,
  filterQuestions,
  mergeQuestions,
  reportedNotes,
  searchQuestions,
  setReport,
  type ChapterCode,
  type Difficulty,
  type Note,
  type QuestionSource,
  type Question,
  type QuestionType,
  type Subject,
  type UserQuestion,
} from '../../domain'
import { TEMPLATE_INFO } from '../../engine'
import { getStorage } from '../../storage'
import { MultiChips } from '../Practice/OptionChips'
import { BankQuestionList } from './BankQuestionList'
import { updateNote } from '../WrongNote/wrongNoteData'
import { downloadJson } from './fileIO'
import { ReportedList } from './ReportedList'

// 가져오기는 스키마 검사(zod)가 필요해서 누를 때만 불러온다 (T7-3)
const ImportPanel = lazy(() => import('./ImportPanel').then((m) => ({ default: m.ImportPanel })))
import pageStyles from '../Page.module.css'
import styles from './Bank.module.css'

const SUBJECT_OPTIONS = [
  { value: 1 as Subject, label: '1과목' },
  { value: 2 as Subject, label: '2과목' },
]
const TYPE_OPTIONS = (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((value) => ({ value, label: QUESTION_TYPE_LABELS[value] }))
const DIFFICULTY_OPTIONS = ([1, 2, 3] as Difficulty[]).map((value) => ({ value, label: `${'★'.repeat(value)} ${DIFFICULTY_LABELS[value]}` }))
const SOURCE_OPTIONS = [
  { value: 'claude' as QuestionSource, label: '기본 문제' },
  { value: 'user' as QuestionSource, label: '직접 추가' },
]

/** 문제 관리 (T7-1) — 전체 문제 검색·필터·미리보기 + 직접 추가·수정·삭제 (T7-2) */
export function BankPage() {
  const navigate = useNavigate()
  // 삭제 확인 창에 띄울 문제
  const [toDelete, setToDelete] = useState<Question | null>(null)
  const [deleteError, setDeleteError] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [userQuestions, setUserQuestions] = useState<UserQuestion[]>([])
  const [query, setQuery] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapter, setChapter] = useState<ChapterCode | ''>('')
  const [types, setTypes] = useState<QuestionType[]>([])
  const [difficulties, setDifficulties] = useState<Difficulty[]>([])
  const [sources, setSources] = useState<QuestionSource[]>([])

  // 오류 신고 (T7-5)
  const [notes, setNotes] = useState<Note[]>([])

  // 직접 추가 문제·오류 신고는 저장소(IndexedDB)에서 불러온다
  useEffect(() => {
    let alive = true
    const storage = getStorage()
    storage
      .listUserQuestions()
      .then((list) => alive && setUserQuestions(list))
      .catch(() => {
        // 저장소를 열 수 없는 환경(사생활 보호 모드 등)이면 기본 문제만 보여 준다
      })
    storage
      .listNotes()
      .then((list) => alive && setNotes(list))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const reported = useMemo(() => reportedNotes(notes), [notes])

  const all = useMemo(() => mergeQuestions([...BUILT_IN_QUESTIONS], userQuestions).questions, [userQuestions])
  const shown = useMemo(
    () =>
      searchQuestions(
        filterQuestions(all, { subjects, chapters: chapter ? [chapter] : [], types, difficulties, sources }),
        query,
      ),
    [all, query, subjects, chapter, types, difficulties, sources],
  )
  const count = (s: Subject) => all.filter((q) => q.subject === s).length
  const filtered = query !== '' || subjects.length + types.length + difficulties.length + sources.length > 0 || chapter !== ''

  return (
    <div className={pageStyles.page}>
      <header className={`${pageStyles.header} ${styles.headerRow}`}>
        <div>
          <h1>문제 관리</h1>
          <p className={pageStyles.desc}>
            전체 {all.length}문제 — 1과목 {count(1)} · 2과목 {count(2)} (직접 추가 {userQuestions.length})
          </p>
        </div>
        <div className={styles.toolRow}>
          <Button onClick={() => navigate('/bank/new')}>+ 문제 추가</Button>
          <Button variant="secondary" aria-expanded={importOpen} onClick={() => setImportOpen((v) => !v)}>
            JSON 가져오기
          </Button>
          <Button variant="secondary" disabled={userQuestions.length === 0} onClick={exportJson}>
            JSON 내보내기
          </Button>
        </div>
      </header>

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {importOpen && (
        <Suspense fallback={<p role="status">불러오는 중…</p>}>
          <ImportPanel
            existingIds={userQuestions.map((q) => q.id)}
            onCancel={() => setImportOpen(false)}
            onDone={(count) => {
              setImportOpen(false)
              setNotice(`${count}문제를 가져왔습니다.`)
              void reload()
            }}
          />
        </Suspense>
      )}

      {reported.length > 0 && (
        <ReportedList
          reported={reported}
          questions={all}
          onEdit={(id) => navigate(`/bank/edit/${id}`)}
          onClear={(ref) => void clearReport(ref)}
        />
      )}

      <Card title="찾기">
        <label className={styles.search}>
          <span className={styles.searchLabel}>검색 (본문·주제·태그·ID·SQL)</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: NULL COUNT, S1-05, 윈도우"
            className={styles.searchInput}
          />
        </label>
        <div className={styles.filters}>
          <MultiChips label="과목" options={SUBJECT_OPTIONS} selected={subjects} onChange={setSubjects} />
          <label className={styles.chapterSelect}>
            <span className={styles.searchLabel}>단원</span>
            <select value={chapter} onChange={(e) => setChapter(e.target.value as ChapterCode | '')} className={styles.select}>
              <option value="">전체 단원</option>
              {CHAPTERS.filter((c) => subjects.length === 0 || subjects.includes(c.subject)).map((c) => (
                <option key={c.code} value={c.code}>
                  {chapterLabel(c.code as ChapterCode)}
                </option>
              ))}
            </select>
          </label>
          <MultiChips label="유형" options={TYPE_OPTIONS} selected={types} onChange={setTypes} />
          <MultiChips label="난이도" options={DIFFICULTY_OPTIONS} selected={difficulties} onChange={setDifficulties} />
          <MultiChips label="출처" options={SOURCE_OPTIONS} selected={sources} onChange={setSources} />
        </div>
      </Card>

      <Card title={filtered ? `찾은 문제 ${shown.length}개` : `전체 문제 ${shown.length}개`}>
        {shown.length === 0 ? <p className={styles.muted}>조건에 맞는 문제가 없습니다.</p> : <BankQuestionList
            key={`${query}|${shown.length}`}
            questions={shown}
            onEdit={(q) => navigate(`/bank/edit/${q.id}`)}
            onDelete={setToDelete}
          />}
        <p className={styles.muted}>
          변형 문제 템플릿 {TEMPLATE_INFO.length}종은 연습·모의고사에서 풀 때마다 새로 만들어지므로 이 목록에는 없습니다.
        </p>
      </Card>

      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="문제를 삭제할까요?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              취소
            </Button>
            <Button variant="danger" onClick={() => void remove()}>
              삭제
            </Button>
          </>
        }
      >
        <p>
          <strong>{toDelete?.id}</strong> {toDelete?.topic}
        </p>
        <p>삭제하면 되돌릴 수 없습니다. 이 문제를 푼 기록은 남지만 오답노트·통계에서는 빠집니다.</p>
        {deleteError && <p role="alert">삭제하지 못했습니다.</p>}
      </Modal>
    </div>
  )

  /** 직접 추가 문제 다시 불러오기 (가져오기 뒤) */
  async function reload() {
    setUserQuestions(await getStorage().listUserQuestions().catch(() => userQuestions))
  }

  /** 직접 추가 문제 전체를 JSON 파일로 (T7-3) */
  function exportJson() {
    downloadJson(`sqld-bank-문제-${fileDate()}.json`, buildQuestionsFile(userQuestions))
    setNotice(`직접 추가 문제 ${userQuestions.length}개를 내보냈습니다.`)
  }

  /** 오류 신고 지우기 (T7-5) — 메모·북마크 등 나머지 오답노트 상태는 그대로 */
  async function clearReport(ref: string) {
    try {
      const next = await updateNote(ref, (n) => setReport(n, null))
      setNotes((list) => list.map((n) => (n.questionRef === ref ? next : n)))
    } catch {
      setNotice('신고를 지우지 못했습니다.')
    }
  }

  async function remove() {
    if (!toDelete) return
    try {
      await getStorage().deleteUserQuestion(toDelete.id)
      setUserQuestions((list) => list.filter((q) => q.id !== toDelete.id))
      setToDelete(null)
      setDeleteError(false)
    } catch {
      setDeleteError(true)
    }
  }
}
