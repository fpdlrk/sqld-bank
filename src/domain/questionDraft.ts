/**
 * 직접 추가 문제 폼의 입력값 (T7-2)
 * 폼은 모든 값을 글자로 들고 있다가, 저장할 때 Question 모양으로 바꿔 스키마로 검사한다.
 */
import { getChapter } from './chapters'
import { parsePastedTable, tableToText } from './tablePaste'
import type { ChapterCode, ChoiceNumber, Difficulty, Question, QuestionType, TableData } from './types'

export interface TableDraft {
  name: string
  /** 붙여 넣은 글자 (탭·쉼표 구분) */
  text: string
}

export interface QuestionDraft {
  id: string
  chapter: ChapterCode
  type: QuestionType
  difficulty: Difficulty
  topic: string
  stem: string
  tables: TableDraft[]
  sql: string
  choices: [string, string, string, string]
  answer: ChoiceNumber | null
  fixedOrder: boolean
  explanation: string
  examPoint: string
  /** 쉼표로 구분 */
  tags: string
}

/** 직접 추가 문제 ID: "U-{단원}-{4자리}" — 그 단원에서 쓰지 않은 다음 번호 */
export function nextUserQuestionId(existingIds: readonly string[], chapter: ChapterCode): string {
  const prefix = `U-${chapter}-`
  const used = existingIds.filter((id) => id.startsWith(prefix)).map((id) => Number(id.slice(prefix.length)))
  const next = used.length === 0 ? 1 : Math.max(...used.filter(Number.isFinite)) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

export function emptyDraft(id: string, chapter: ChapterCode): QuestionDraft {
  return {
    id,
    chapter,
    type: 'concept',
    difficulty: 2,
    topic: '',
    stem: '',
    tables: [],
    sql: '',
    choices: ['', '', '', ''],
    answer: null,
    fixedOrder: false,
    explanation: '',
    examPoint: '',
    tags: '',
  }
}

/** 저장된 문제 → 폼 입력값 (수정할 때) */
export function draftFromQuestion(q: Question): QuestionDraft {
  return {
    id: q.id,
    chapter: q.chapter,
    type: q.type,
    difficulty: q.difficulty,
    topic: q.topic,
    stem: q.stem,
    tables: (q.tables ?? []).map((t) => ({ name: t.name ?? '', text: tableToText(t) })),
    sql: q.sql ?? '',
    choices: [...q.choices],
    answer: q.answer,
    fixedOrder: q.fixedOrder ?? false,
    explanation: q.explanation,
    examPoint: q.examPoint,
    tags: (q.tags ?? []).join(', '),
  }
}

export interface DraftConversion {
  /** 스키마 검사에 넣을 값 (아직 검사 전) */
  candidate: Record<string, unknown>
  /** 표 붙여넣기 오류 — 스키마 검사 전에 걸러지는 것 */
  tableProblems: { path: string; message: string }[]
}

/** 폼 입력값 → 검사할 문제 후보. 빈 선택 항목(SQL·표·태그)은 아예 넣지 않는다 */
export function draftToCandidate(d: QuestionDraft): DraftConversion {
  const tables: TableData[] = []
  const tableProblems: DraftConversion['tableProblems'] = []
  d.tables.forEach((t, i) => {
    if (t.text.trim() === '') return
    const parsed = parsePastedTable(t.text, t.name)
    if (parsed.ok) tables.push(parsed.table)
    else tableProblems.push({ path: `tables.${i}`, message: parsed.message })
  })
  const tags = d.tags
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const candidate: Record<string, unknown> = {
    id: d.id,
    subject: getChapter(d.chapter).subject,
    chapter: d.chapter,
    topic: d.topic.trim(),
    type: d.type,
    difficulty: d.difficulty,
    stem: d.stem.trim(),
    choices: d.choices.map((c) => c.trim()),
    answer: d.answer,
    explanation: d.explanation.trim(),
    examPoint: d.examPoint.trim(),
    source: 'user',
  }
  if (tables.length > 0) candidate.tables = tables
  if (d.sql.trim()) candidate.sql = d.sql.trim()
  if (d.fixedOrder) candidate.fixedOrder = true
  if (tags.length > 0) candidate.tags = tags
  return { candidate, tableProblems }
}
