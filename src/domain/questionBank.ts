import type { ChapterCode, Difficulty, Question, QuestionSource, QuestionType, Subject } from './types'

/**
 * 문제 은행 다루기 (T2-5) — 합치기·거르기·찾기
 *
 * 어디서 불러왔는지(JSON 파일, IndexedDB)는 모르는 순수 함수들이다.
 * 기본 문제 불러오기는 src/data/builtInQuestions.ts, 직접 추가 문제는 storage 어댑터(T2-6) 담당.
 */

export interface MergeResult {
  /** ID 순으로 정렬된 전체 문제 */
  questions: Question[]
  /** ID가 겹쳐서 빠진 직접 추가 문제의 ID (화면에서 알려 주기용) */
  skippedIds: string[]
}

/**
 * 기본 문제 + 직접 추가 문제 합치기
 * 직접 추가 문제는 "U-" ID를 쓰므로 원래 겹칠 일이 없지만,
 * 가져오기(T7-3) 등으로 겹치면 기본 문제를 남기고 겹친 것은 skippedIds로 알려 준다.
 */
export function mergeQuestions(builtIn: Question[], user: Question[] = []): MergeResult {
  const byId = new Map<string, Question>()
  const skippedIds: string[] = []

  for (const q of [...builtIn, ...user]) {
    if (byId.has(q.id)) skippedIds.push(q.id)
    else byId.set(q.id, q)
  }

  const questions = [...byId.values()].sort(compareById)
  return { questions, skippedIds }
}

/** "M1-01-0001" < "S1-05-0003" < "U-M1-01-0001" 순 (단원 순 → 번호 순, 직접 추가는 뒤로) */
function compareById(a: Question, b: Question): number {
  const ua = a.id.startsWith('U-')
  const ub = b.id.startsWith('U-')
  if (ua !== ub) return ua ? 1 : -1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * 거르기 조건. 각 항목은 "이 중 하나라도 맞으면 통과"이고,
 * 비워 두거나(undefined, 빈 배열) 안 넣으면 그 조건은 따지지 않는다.
 */
export interface QuestionFilter {
  subjects?: Subject[]
  chapters?: ChapterCode[]
  types?: QuestionType[]
  difficulties?: Difficulty[]
  sources?: QuestionSource[]
}

const matches = <T>(allowed: T[] | undefined, value: T) =>
  !allowed || allowed.length === 0 || allowed.includes(value)

export function filterQuestions(questions: Question[], filter: QuestionFilter = {}): Question[] {
  return questions.filter(
    (q) =>
      matches(filter.subjects, q.subject) &&
      matches(filter.chapters, q.chapter) &&
      matches(filter.types, q.type) &&
      matches(filter.difficulties, q.difficulty) &&
      matches(filter.sources, q.source),
  )
}

/** ID로 문제 찾기 (없으면 undefined) */
export function findQuestion(questions: Question[], id: string): Question | undefined {
  return questions.find((q) => q.id === id)
}

/** 단원별 문제 수 — 연습 설정 화면(T3-3)에서 "S1-05 (3문제)"처럼 보여 주기용 */
export function countByChapter(questions: Question[]): Map<ChapterCode, number> {
  const counts = new Map<ChapterCode, number>()
  for (const q of questions) counts.set(q.chapter, (counts.get(q.chapter) ?? 0) + 1)
  return counts
}
