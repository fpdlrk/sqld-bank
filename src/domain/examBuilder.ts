/**
 * 모의고사 출제기 (T5-2)
 *
 * 1) 단원별 목표 문항 수 = 단원표(chapters.ts)의 비중
 *    - 1과목: 고정 비중 9 + "0~1문항" 단원(optional) 중 하나에 1문항
 * 2) 2과목의 templateRatio(기본 30%)만큼 변형 문제 자리를 템플릿이 있는 단원에 골고루 나눈다
 * 3) 남은 자리는 그 단원의 고정 문제로 — 최근 모의고사에 나온 문제는 뒤로 미룬다
 * 4) 모자라면: 같은 단원 변형 문제 → 같은 과목 다른 단원 고정 문제 → 같은 과목 변형 문제 순으로 채우고,
 *    그래도 모자라면 문항 수를 줄여서 내고 shortage로 알린다
 * 5) 순서: 1과목 → 2과목, 과목 안에서는 단원 순 (단원 안에서는 무작위)
 */
import { CHAPTERS, type ChapterInfo } from './chapters'
import { EXAM_RULES, EXAM_SUBJECTS } from './examRules'
import type { PracticeItem } from './practice'
import { shuffled } from './practice'
import type { ChapterCode, Question, QuestionRef, Session, Subject, TemplateInfo } from './types'

/** 기본 변형 문제 비율 (2과목 기준) */
export const DEFAULT_TEMPLATE_RATIO = 0.3

/** 최근 몇 회의 모의고사에 나온 고정 문제를 뒤로 미룰지 */
export const RECENT_EXAM_COUNT = 3

export interface ExamBuildOptions {
  /** 2과목 중 변형 문제 비율 0~1 (기본 0.3) */
  templateRatio?: number
  /** 최근 모의고사에 나온 문제 키 — 이 문제들은 후순위 */
  recentRefs?: ReadonlySet<QuestionRef>
  random?: () => number
}

export interface ChapterPlan {
  chapter: ChapterCode
  subject: Subject
  /** 단원표 비중에 따른 목표 */
  target: number
  fixed: number
  templates: number
}

export interface SubjectPlan {
  target: number
  planned: number
  templates: number
  /** 모자란 문항 수 */
  missing: number
}

export interface ExamPlan {
  /** 출제 순서대로 */
  items: PracticeItem[]
  /** 단원별 구성 — 단원 순, 목표 0인 단원 중 실제로 쓰이지 않은 것은 뺀다 */
  chapters: ChapterPlan[]
  subjects: Record<Subject, SubjectPlan>
  /** 전체 부족 문항 수 (0이면 정상) */
  shortage: number
}

/** 최근 모의고사 회차들 → 그 회차에 나온 문제 키 */
export function recentExamRefs(sessions: readonly Session[], count = RECENT_EXAM_COUNT): Set<QuestionRef> {
  const exams = sessions
    .filter((s) => s.mode === 'exam')
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, count)
  return new Set(exams.flatMap((s) => s.questionRefs))
}

/** 단원별 목표 문항 수. 1과목 optional 단원은 하나만 1문항 (문제가 있는 단원을 우선) */
export function chapterTargets(
  hasQuestions: (chapter: ChapterCode) => boolean,
  random: () => number,
): Map<ChapterCode, number> {
  const targets = new Map<ChapterCode, number>()
  for (const c of CHAPTERS as readonly ChapterInfo[]) targets.set(c.code as ChapterCode, c.examWeight)
  const optional = CHAPTERS.filter((c) => 'optional' in c && c.optional).map((c) => c.code as ChapterCode)
  const withQuestions = optional.filter(hasQuestions)
  const pool = withQuestions.length > 0 ? withQuestions : optional
  const chosen = shuffled(pool, random)[0]
  if (chosen) targets.set(chosen, 1)
  return targets
}

export function buildExamPlan(
  questions: readonly Question[],
  templates: readonly TemplateInfo[],
  options: ExamBuildOptions = {},
): ExamPlan {
  const { templateRatio = DEFAULT_TEMPLATE_RATIO, recentRefs = new Set<QuestionRef>(), random = Math.random } = options
  const ratio = Math.min(1, Math.max(0, templateRatio))

  // 단원별 고정 문제 (최근에 안 나온 것 먼저, 각각 무작위 순서)
  const fixedByChapter = new Map<ChapterCode, Question[]>()
  for (const q of questions) fixedByChapter.set(q.chapter, [...(fixedByChapter.get(q.chapter) ?? []), q])
  for (const [ch, list] of fixedByChapter) {
    const fresh = shuffled(list.filter((q) => !recentRefs.has(q.id)), random)
    const recent = shuffled(list.filter((q) => recentRefs.has(q.id)), random)
    fixedByChapter.set(ch, [...fresh, ...recent])
  }
  const templatesByChapter = new Map<ChapterCode, TemplateInfo[]>()
  for (const t of templates) templatesByChapter.set(t.chapter, [...(templatesByChapter.get(t.chapter) ?? []), t])

  const targets = chapterTargets((ch) => (fixedByChapter.get(ch)?.length ?? 0) > 0 || templatesByChapter.has(ch), random)

  // 단원별 배정: chapter → 고정 문제 / 변형 문제 템플릿 목록
  const fixedPicked = new Map<ChapterCode, Question[]>()
  const tplPicked = new Map<ChapterCode, TemplateInfo[]>()
  const usedIds = new Set<string>()
  const add = <T>(m: Map<ChapterCode, T[]>, ch: ChapterCode, v: T) => m.set(ch, [...(m.get(ch) ?? []), v])
  const filled = (ch: ChapterCode) => (fixedPicked.get(ch)?.length ?? 0) + (tplPicked.get(ch)?.length ?? 0)
  const pickTemplate = (ch: ChapterCode) => shuffled(templatesByChapter.get(ch) ?? [], random)[0]

  const subjects = {} as Record<Subject, SubjectPlan>

  for (const subject of EXAM_SUBJECTS) {
    const chapters = CHAPTERS.filter((c) => c.subject === subject).map((c) => c.code as ChapterCode)
    const target = EXAM_RULES.subjects[subject].questionCount

    // 2) 변형 문제 자리: 템플릿이 있는 단원에 돌아가며 하나씩 (단원 목표를 넘지 않게)
    let templateSlots = Math.round(target * ratio)
    let progress = true
    while (templateSlots > 0 && progress) {
      progress = false
      for (const ch of shuffled(chapters.filter((c) => templatesByChapter.has(c)), random)) {
        if (templateSlots === 0) break
        if (filled(ch) >= (targets.get(ch) ?? 0)) continue
        add(tplPicked, ch, pickTemplate(ch)!)
        templateSlots--
        progress = true
      }
    }

    // 3) 고정 문제 + 4-1) 같은 단원 변형 문제
    for (const ch of chapters) {
      const pool = fixedByChapter.get(ch) ?? []
      while (filled(ch) < (targets.get(ch) ?? 0)) {
        const q = pool.find((x) => !usedIds.has(x.id))
        if (q) {
          usedIds.add(q.id)
          add(fixedPicked, ch, q)
        } else if (templatesByChapter.has(ch)) {
          add(tplPicked, ch, pickTemplate(ch)!)
        } else break
      }
    }

    // 4-2) 같은 과목 다른 단원 고정 문제 (최근에 안 나온 것 먼저) → 4-3) 같은 과목 변형 문제
    const count = () => chapters.reduce((s, ch) => s + filled(ch), 0)
    const spareFixed = [
      ...shuffled(questions.filter((q) => q.subject === subject && !usedIds.has(q.id) && !recentRefs.has(q.id)), random),
      ...shuffled(questions.filter((q) => q.subject === subject && !usedIds.has(q.id) && recentRefs.has(q.id)), random),
    ]
    for (const q of spareFixed) {
      if (count() >= target) break
      usedIds.add(q.id)
      add(fixedPicked, q.chapter, q)
    }
    const subjectTemplates = templates.filter((t) => t.subject === subject)
    while (count() < target && subjectTemplates.length > 0) {
      const t = shuffled(subjectTemplates, random)[0]!
      add(tplPicked, t.chapter, t)
    }

    const templatesInSubject = chapters.reduce((s, ch) => s + (tplPicked.get(ch)?.length ?? 0), 0)
    subjects[subject] = { target, planned: count(), templates: templatesInSubject, missing: Math.max(0, target - count()) }
  }

  // 5) 순서: 단원 순, 단원 안에서는 고정·변형을 섞는다
  const items: PracticeItem[] = []
  const chapterPlans: ChapterPlan[] = []
  for (const c of CHAPTERS) {
    const ch = c.code as ChapterCode
    const fixed = fixedPicked.get(ch) ?? []
    const tpls = tplPicked.get(ch) ?? []
    const target = targets.get(ch) ?? 0
    if (target === 0 && fixed.length + tpls.length === 0) continue
    chapterPlans.push({ chapter: ch, subject: c.subject, target, fixed: fixed.length, templates: tpls.length })
    const inChapter: PracticeItem[] = [
      ...fixed.map((question): PracticeItem => ({ kind: 'fixed', question })),
      ...tpls.map((template): PracticeItem => ({ kind: 'template', template })),
    ]
    items.push(...shuffled(inChapter, random))
  }

  const shortage = EXAM_SUBJECTS.reduce((s, sub) => s + subjects[sub].missing, 0)
  return { items, chapters: chapterPlans, subjects, shortage }
}

// ───────────────────────────── 모의고사 설정 (T5-3) ─────────────────────────────

/** 시작 화면에서 고를 수 있는 변형 문제 비율 */
export const TEMPLATE_RATIO_OPTIONS = [0, 0.3, 0.5] as const

export interface ExamSettings {
  templateRatio: number
}

export const EXAM_SETTINGS_KEY = 'examSettings'

/** 저장된 설정 정리 — 목록에 없는 값이면 기본값(30%) */
export function normalizeExamSettings(raw: unknown): ExamSettings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const ratio = TEMPLATE_RATIO_OPTIONS.find((o) => o === r.templateRatio)
  return { templateRatio: ratio ?? DEFAULT_TEMPLATE_RATIO }
}
