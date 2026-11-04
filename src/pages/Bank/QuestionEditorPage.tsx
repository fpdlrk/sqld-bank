import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Card, Markdown, QuestionView } from '../../components'
import {
  CHAPTERS,
  CHOICE_MARKS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  chapterLabel,
  draftFromQuestion,
  draftToCandidate,
  emptyDraft,
  nextUserQuestionId,
  type ChapterCode,
  type ChoiceNumber,
  type Difficulty,
  type QuestionDraft,
  type QuestionType,
  type UserQuestion,
} from '../../domain'
// 스키마 검증(zod)은 크기가 커서 이 화면에서만 직접 불러온다 (이 화면은 따로 떼어 불러옴)
import { validateQuestion, type FieldProblem } from '../../domain/questionSchema'
import { getStorage } from '../../storage'
import { TablesEditor } from './TablesEditor'
import pageStyles from '../Page.module.css'
import styles from './Editor.module.css'

const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  subject: '과목',
  chapter: '단원',
  topic: '세부 주제',
  type: '유형',
  difficulty: '난이도',
  stem: '문제 본문',
  tables: '예시 테이블',
  sql: 'SQL',
  choices: '보기',
  answer: '정답',
  explanation: '해설',
  examPoint: '시험 포인트',
  tags: '태그',
}

/** "choices.2" → "보기 ③", "tables.0.rows.1" → "예시 테이블 1번째" */
export function fieldLabel(path: string): string {
  const [head = '', idx] = path.split('.')
  if (head === 'choices' && idx !== undefined) return `보기 ${CHOICE_MARKS[(Number(idx) + 1) as ChoiceNumber]}`
  if (head === 'tables' && idx !== undefined) return `예시 테이블 ${Number(idx) + 1}번째`
  return FIELD_LABELS[head] ?? (head || '문제 전체')
}

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; draft: QuestionDraft; existing: UserQuestion | undefined; ids: string[] }

/** 문제 직접 추가·수정 (T7-2) — 주소: #/bank/new, #/bank/edit/{ID} */
export function QuestionEditorPage() {
  const { id: editId } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [problems, setProblems] = useState<FieldProblem[]>([])
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const problemsRef = useRef<HTMLDivElement>(null)

  // 저장에 실패하면 문제점 목록이 보이도록 위로
  useEffect(() => {
    if (problems.length > 0) problemsRef.current?.scrollIntoView?.({ block: 'start' })
  }, [problems])

  useEffect(() => {
    let alive = true
    getStorage()
      .listUserQuestions()
      .catch(() => [])
      .then((list) => {
        if (!alive) return
        const ids = list.map((q) => q.id)
        if (editId) {
          const existing = list.find((q) => q.id === editId)
          setState(existing ? { status: 'ready', draft: draftFromQuestion(existing), existing, ids } : { status: 'missing' })
        } else {
          const chapter: ChapterCode = 'S1-05'
          setState({ status: 'ready', draft: emptyDraft(nextUserQuestionId(ids, chapter), chapter), existing: undefined, ids })
        }
      })
    return () => {
      alive = false
    }
  }, [editId])

  const draft = state.status === 'ready' ? state.draft : undefined
  const conversion = useMemo(() => (draft ? draftToCandidate(draft) : undefined), [draft])

  if (state.status === 'loading') return <p role="status">불러오는 중…</p>
  if (state.status === 'missing' || !draft || !conversion) {
    return (
      <div className={pageStyles.page}>
        <h1>문제를 찾을 수 없습니다</h1>
        <p className={pageStyles.desc}>직접 추가한 문제만 수정할 수 있습니다.</p>
        <Link to="/bank">문제 관리로</Link>
      </div>
    )
  }

  const isEdit = state.existing !== undefined
  const set = (patch: Partial<QuestionDraft>) => setState({ ...state, draft: { ...draft, ...patch } })
  const setChoice = (i: number, value: string) => {
    const choices = [...draft.choices] as QuestionDraft['choices']
    choices[i] = value
    set({ choices })
  }
  /** 새 문제는 단원을 바꾸면 ID도 그 단원의 다음 번호로 */
  const setChapter = (chapter: ChapterCode) => set({ chapter, id: nextUserQuestionId(state.ids, chapter) })

  async function save() {
    const { candidate, tableProblems } = draftToCandidate(draft!)
    const result = validateQuestion(candidate)
    const all = [...tableProblems, ...(result.ok ? [] : result.problems)]
    setProblems(all)
    if (!result.ok || all.length > 0) return
    setSaving(true)
    const now = new Date().toISOString()
    const question: UserQuestion = {
      ...result.question,
      source: 'user',
      createdAt: state.status === 'ready' && state.existing ? state.existing.createdAt : now,
      updatedAt: now,
    }
    try {
      await getStorage().putUserQuestion(question)
      navigate('/bank')
    } catch {
      setSaving(false)
      setProblems([{ path: '', message: '저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.' }])
    }
  }

  // 미리보기용 문제 (검사 전이라 빈 칸이 있을 수 있다)
  const c = conversion.candidate
  const previewQuestion = {
    ...(c as object),
    choices: draft.choices,
    answer: draft.answer ?? 1,
  } as UserQuestion

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <h1>{isEdit ? '문제 수정' : '문제 추가'}</h1>
        <p className={pageStyles.desc}>
          ID <code>{draft.id}</code> · 저장하면 연습·모의고사·오답노트에서 기본 문제처럼 쓰입니다.
        </p>
      </header>

      {problems.length > 0 && (
        <div ref={problemsRef} className={styles.problems} role="alert">
          <p>
            <strong>저장하지 못했습니다.</strong> 아래 {problems.length}가지를 고쳐 주세요.
          </p>
          <ul>
            {problems.map((p, i) => (
              <li key={i}>
                <strong>{fieldLabel(p.path)}</strong>: {p.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card title="분류">
        <div className={styles.row}>
          <label className={styles.field}>
            <span>단원 (과목은 자동)</span>
            <select
              className={styles.input}
              value={draft.chapter}
              disabled={isEdit}
              onChange={(e) => setChapter(e.target.value as ChapterCode)}
            >
              {CHAPTERS.map((ch) => (
                <option key={ch.code} value={ch.code}>
                  {ch.subject}과목 · {chapterLabel(ch.code as ChapterCode)}
                </option>
              ))}
            </select>
            {isEdit && <small className={styles.hint}>수정할 때는 단원을 바꿀 수 없습니다 (ID와 풀이 기록이 연결돼 있어서)</small>}
          </label>
          <label className={styles.field}>
            <span>유형</span>
            <select className={styles.input} value={draft.type} onChange={(e) => set({ type: e.target.value as QuestionType })}>
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>난이도</span>
            <select
              className={styles.input}
              value={draft.difficulty}
              onChange={(e) => set({ difficulty: Number(e.target.value) as Difficulty })}
            >
              {([1, 2, 3] as Difficulty[]).map((d) => (
                <option key={d} value={d}>
                  {'★'.repeat(d)} {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={styles.field}>
          <span>세부 주제 (40자 이내, 예: COUNT(*)와 COUNT(컬럼))</span>
          <input className={styles.input} value={draft.topic} maxLength={40} onChange={(e) => set({ topic: e.target.value })} />
        </label>
      </Card>

      <Card title="문제">
        <label className={styles.field}>
          <span>본문 (Markdown — **굵게**, `코드`, 목록, 표 사용 가능)</span>
          <textarea className={styles.textarea} rows={4} value={draft.stem} onChange={(e) => set({ stem: e.target.value })} />
        </label>
        <TablesEditor tables={draft.tables} onChange={(tables) => set({ tables })} />
        <label className={styles.field}>
          <span>SQL (선택, Oracle 문법)</span>
          <textarea
            className={`${styles.textarea} ${styles.mono}`}
            rows={4}
            spellCheck={false}
            value={draft.sql}
            onChange={(e) => set({ sql: e.target.value })}
          />
        </label>
      </Card>

      <Card title="보기와 정답">
        <fieldset className={styles.choices}>
          <legend className={styles.hint}>정답인 보기의 동그라미를 고르세요</legend>
          {draft.choices.map((text, i) => {
            const no = (i + 1) as ChoiceNumber
            return (
              <div key={i} className={styles.choiceRow}>
                <label className={styles.answerRadio}>
                  <input type="radio" name="answer" checked={draft.answer === no} onChange={() => set({ answer: no })} />
                  <span>{CHOICE_MARKS[no]} 정답</span>
                </label>
                <input
                  className={styles.input}
                  aria-label={`보기 ${CHOICE_MARKS[no]}`}
                  value={text}
                  onChange={(e) => setChoice(i, e.target.value)}
                />
              </div>
            )
          })}
        </fieldset>
        <label className={styles.check}>
          <input type="checkbox" checked={draft.fixedOrder} onChange={(e) => set({ fixedOrder: e.target.checked })} />
          <span>보기 순서 고정 (보기가 크기 순이거나 "①과 ③ 모두"처럼 다른 보기를 가리킬 때)</span>
        </label>
      </Card>

      <Card title="해설">
        <label className={styles.field}>
          <span>해설 (정답 이유 → 오답 이유 순서로. ①~④는 보기 번호에만 쓰기)</span>
          <textarea className={styles.textarea} rows={6} value={draft.explanation} onChange={(e) => set({ explanation: e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>시험 포인트 (한 줄)</span>
          <input className={styles.input} value={draft.examPoint} onChange={(e) => set({ examPoint: e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>태그 (쉼표로 구분, 선택)</span>
          <input className={styles.input} value={draft.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="NULL, 집계함수" />
        </label>
      </Card>

      {preview && (
        <Card title="미리보기">
          <QuestionView question={previewQuestion} {...(draft.answer !== null && { answer: draft.answer })} />
          {draft.explanation.trim() && <Markdown source={draft.explanation} />}
        </Card>
      )}

      <div className={styles.actions}>
        <Button size="lg" disabled={saving} onClick={() => void save()}>
          {saving ? '저장 중…' : '저장'}
        </Button>
        <Button size="lg" variant="secondary" aria-pressed={preview} onClick={() => setPreview((v) => !v)}>
          {preview ? '미리보기 닫기' : '미리보기'}
        </Button>
        <Button size="lg" variant="ghost" onClick={() => navigate('/bank')}>
          취소
        </Button>
      </div>
    </div>
  )
}
