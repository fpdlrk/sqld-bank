/**
 * 단원별 연습 출제 (T3-3)
 * 설정 → 조건에 맞는 후보 → (섞기) → 문항 수만큼 자르기. 화면과 무관한 순수 함수.
 */
import { CHAPTER_CODES, chaptersOfSubject } from './chapters'
import { filterQuestions } from './questionBank'
import { parseRef } from './questionRef'
import type {
  Attempt,
  ChapterCode,
  Difficulty,
  Question,
  QuestionRef,
  QuestionType,
  Subject,
  TemplateInfo,
} from './types'

/** 풀이 상태 조건: 전체 / 한 번도 안 푼 문제만 / 최근에 틀린 문제만 */
export type ProgressFilter = 'all' | 'unsolved' | 'wrong'

/** 문항 수 */
export type PracticeCount = 10 | 20 | 'all'

export interface PracticeSettings {
  /** 비어 있으면 두 과목 모두 */
  subjects: Subject[]
  /** 비어 있으면 (고른 과목의) 모든 단원 */
  chapters: ChapterCode[]
  types: QuestionType[]
  difficulties: Difficulty[]
  progress: ProgressFilter
  count: PracticeCount
  shuffle: boolean
  /** 보기 순서 섞기 (T3-5) */
  shuffleChoices: boolean
  /** 변형 문제(템플릿) 포함 (T4-7) */
  includeTemplates: boolean
}

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
  subjects: [],
  chapters: [],
  types: [],
  difficulties: [],
  progress: 'all',
  count: 10,
  shuffle: true,
  shuffleChoices: true,
  includeTemplates: true,
}

/** 마지막 설정을 저장해 두는 meta 키 */
export const PRACTICE_SETTINGS_KEY = 'practiceSettings'

const QUESTION_TYPES: readonly QuestionType[] = [
  'concept',
  'sql_result',
  'sql_error',
  'sql_equivalent',
  'sql_fill',
  'modeling',
  'scenario',
]

/**
 * 저장돼 있던 설정을 믿을 수 있는 모양으로 정리한다.
 * 앱이 바뀌어 없어진 값(예: 지워진 단원 코드)은 버리고, 빠진 값은 기본값으로 채운다.
 */
export function normalizePracticeSettings(raw: unknown): PracticeSettings {
  const d = DEFAULT_PRACTICE_SETTINGS
  if (typeof raw !== 'object' || raw === null) return { ...d }
  const r = raw as Record<string, unknown>
  const pick = <T>(value: unknown, allowed: readonly T[]): T[] =>
    Array.isArray(value) ? [...new Set(value.filter((v): v is T => allowed.includes(v as T)))] : []

  const settings: PracticeSettings = {
    subjects: pick<Subject>(r.subjects, [1, 2]),
    chapters: pick<ChapterCode>(r.chapters, CHAPTER_CODES),
    types: pick<QuestionType>(r.types, QUESTION_TYPES),
    difficulties: pick<Difficulty>(r.difficulties, [1, 2, 3]),
    progress: r.progress === 'unsolved' || r.progress === 'wrong' ? r.progress : d.progress,
    count: r.count === 10 || r.count === 20 || r.count === 'all' ? r.count : d.count,
    shuffle: typeof r.shuffle === 'boolean' ? r.shuffle : d.shuffle,
    shuffleChoices: typeof r.shuffleChoices === 'boolean' ? r.shuffleChoices : d.shuffleChoices,
    includeTemplates: typeof r.includeTemplates === 'boolean' ? r.includeTemplates : d.includeTemplates,
  }
  return withSubjects(settings, settings.subjects)
}

/** 과목을 바꾸면 고른 과목에 속하지 않는 단원 선택은 지운다 */
export function withSubjects(settings: PracticeSettings, subjects: Subject[]): PracticeSettings {
  const visible = new Set<string>(
    (subjects.length === 0 ? [1, 2] : subjects).flatMap((s) => chaptersOfSubject(s as Subject).map((c) => c.code)),
  )
  return { ...settings, subjects, chapters: settings.chapters.filter((c) => visible.has(c)) }
}

/** 문제별 풀이 요약 */
export interface QuestionStat {
  /** 푼 횟수 */
  tries: number
  /** 가장 최근 시도가 정답인지 */
  lastCorrect: boolean
  lastAt: string
}

/** 풀이 기록 → 문제별 요약 (가장 최근 시도 기준) */
export function summarizeAttempts(attempts: readonly Attempt[]): Map<QuestionRef, QuestionStat> {
  const stats = new Map<QuestionRef, QuestionStat>()
  for (const a of attempts) {
    const prev = stats.get(a.questionRef)
    if (!prev) {
      stats.set(a.questionRef, { tries: 1, lastCorrect: a.correct, lastAt: a.at })
    } else {
      prev.tries++
      if (a.at >= prev.lastAt) {
        prev.lastCorrect = a.correct
        prev.lastAt = a.at
      }
    }
  }
  return stats
}

/** 조건에 맞는 모든 후보 (ID 순) */
export function practiceCandidates(
  questions: Question[],
  settings: PracticeSettings,
  stats: ReadonlyMap<QuestionRef, QuestionStat>,
): Question[] {
  const filtered = filterQuestions(questions, {
    subjects: settings.subjects,
    chapters: settings.chapters,
    types: settings.types,
    difficulties: settings.difficulties,
  })
  switch (settings.progress) {
    case 'unsolved':
      return filtered.filter((q) => !stats.has(q.id))
    case 'wrong':
      return filtered.filter((q) => stats.get(q.id)?.lastCorrect === false)
    default:
      return filtered
  }
}

/** 배열 섞기 (Fisher–Yates). random은 0 이상 1 미만을 돌려주는 함수 — 테스트에서 고정값을 넣는다 */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

/** 이번 연습에 낼 문제 */
export function pickPracticeQuestions(
  questions: Question[],
  settings: PracticeSettings,
  stats: ReadonlyMap<QuestionRef, QuestionStat>,
  random: () => number = Math.random,
): Question[] {
  const candidates = practiceCandidates(questions, settings, stats)
  const ordered = settings.shuffle ? shuffled(candidates, random) : candidates
  return settings.count === 'all' ? ordered : ordered.slice(0, settings.count)
}

// ───────────────────────────── 변형 문제(템플릿) 포함 출제 (T4-7) ─────────────────────────────

/** 템플릿 하나가 출제 후보에서 차지하는 몫 (시드만 바꿔 여러 번 낼 수 있으므로) */
export const TEMPLATE_SLOTS = 3

/**
 * 출제 후보 1개
 * - fixed: 고정 문제
 * - template: 변형 문제. seed가 없으면 출제할 때 새 시드를 뽑고, 있으면 그 문제를 그대로 다시 낸다(틀린 문제 다시 풀기)
 */
export type PracticeItem =
  | { kind: 'fixed'; question: Question }
  | { kind: 'template'; template: TemplateInfo; seed?: number }

const allows = <T>(allowed: readonly T[], value: T) => allowed.length === 0 || allowed.includes(value)

/** 과목·단원·유형·난이도 조건에 맞는 템플릿 */
export function filterTemplates(templates: readonly TemplateInfo[], settings: PracticeSettings): TemplateInfo[] {
  return templates.filter(
    (t) =>
      allows(settings.subjects, t.subject) &&
      allows(settings.chapters, t.chapter) &&
      allows(settings.types, t.type) &&
      allows(settings.difficulties, t.difficulty),
  )
}

/**
 * 조건에 맞는 모든 후보 (고정 문제 ID 순 → 변형 문제)
 * - 전체·안 푼 문제: 템플릿마다 TEMPLATE_SLOTS개 (변형 문제는 매번 새로 만들어지므로 늘 "안 푼 문제")
 * - 틀린 문제: 가장 최근에 틀린 "템플릿ID#시드"를 그대로 다시 낸다
 */
export function practiceItems(
  questions: Question[],
  templates: readonly TemplateInfo[],
  settings: PracticeSettings,
  stats: ReadonlyMap<QuestionRef, QuestionStat>,
): PracticeItem[] {
  const fixed: PracticeItem[] = practiceCandidates(questions, settings, stats).map((question) => ({ kind: 'fixed', question }))
  if (!settings.includeTemplates) return fixed

  const allowed = new Map(filterTemplates(templates, settings).map((t) => [t.id, t]))
  if (settings.progress === 'wrong') {
    const retry: PracticeItem[] = []
    for (const [ref, stat] of stats) {
      if (stat.lastCorrect) continue
      const parsed = parseRef(ref)
      const template = parsed.kind === 'template' ? allowed.get(parsed.templateId) : undefined
      if (template && parsed.kind === 'template') retry.push({ kind: 'template', template, seed: parsed.seed })
    }
    return [...fixed, ...retry]
  }
  const fresh = [...allowed.values()].flatMap((template) =>
    Array.from({ length: TEMPLATE_SLOTS }, (): PracticeItem => ({ kind: 'template', template })),
  )
  return [...fixed, ...fresh]
}

/** 이번 연습에 낼 후보 (섞기·문항 수 적용) */
export function pickPracticeItems(
  questions: Question[],
  templates: readonly TemplateInfo[],
  settings: PracticeSettings,
  stats: ReadonlyMap<QuestionRef, QuestionStat>,
  random: () => number = Math.random,
): PracticeItem[] {
  const items = practiceItems(questions, templates, settings, stats)
  const ordered = settings.shuffle ? shuffled(items, random) : items
  return settings.count === 'all' ? ordered : ordered.slice(0, settings.count)
}
