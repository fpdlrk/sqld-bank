import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components'
import { BUILT_IN_QUESTIONS } from '../../data/builtInQuestions'
import {
  CHAPTERS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  chapterLabel,
  filterQuestions,
  mergeQuestions,
  searchQuestions,
  type ChapterCode,
  type Difficulty,
  type QuestionSource,
  type QuestionType,
  type Subject,
  type UserQuestion,
} from '../../domain'
import { TEMPLATE_INFO } from '../../engine'
import { getStorage } from '../../storage'
import { MultiChips } from '../Practice/OptionChips'
import { BankQuestionList } from './BankQuestionList'
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

/** 문제 관리 (T7-1) — 전체 문제 검색·필터·미리보기 */
export function BankPage() {
  const [userQuestions, setUserQuestions] = useState<UserQuestion[]>([])
  const [query, setQuery] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapter, setChapter] = useState<ChapterCode | ''>('')
  const [types, setTypes] = useState<QuestionType[]>([])
  const [difficulties, setDifficulties] = useState<Difficulty[]>([])
  const [sources, setSources] = useState<QuestionSource[]>([])

  // 직접 추가 문제는 저장소(IndexedDB)에서 불러온다
  useEffect(() => {
    let alive = true
    getStorage()
      .listUserQuestions()
      .then((list) => alive && setUserQuestions(list))
      .catch(() => {
        // 저장소를 열 수 없는 환경(사생활 보호 모드 등)이면 기본 문제만 보여 준다
      })
    return () => {
      alive = false
    }
  }, [])

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
      <header className={pageStyles.header}>
        <h1>문제 관리</h1>
        <p className={pageStyles.desc}>
          전체 {all.length}문제 — 1과목 {count(1)} · 2과목 {count(2)} (직접 추가 {userQuestions.length})
        </p>
      </header>

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
        {shown.length === 0 ? <p className={styles.muted}>조건에 맞는 문제가 없습니다.</p> : <BankQuestionList key={`${query}|${shown.length}`} questions={shown} />}
        <p className={styles.muted}>
          변형 문제 템플릿 {TEMPLATE_INFO.length}종은 연습·모의고사에서 풀 때마다 새로 만들어지므로 이 목록에는 없습니다.
        </p>
      </Card>
    </div>
  )
}
