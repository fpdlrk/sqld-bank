import { BUILT_IN_QUESTIONS } from '../../data/builtInQuestions'
import {
  mergeQuestions,
  parseRef,
  refOf,
  type AnyQuestion,
  type PracticeItem,
  type Question,
  type QuestionRef,
  type WrongNoteInfo,
} from '../../domain'
import { TEMPLATE_INFO, generateTemplateQuestion, randomSeed } from '../../engine'
import { getStorage } from '../../storage'

/** 기본 문제 + 직접 추가 문제 (저장소를 못 열면 기본 문제만) */
export async function loadAllQuestions(): Promise<Question[]> {
  const userQuestions = await getStorage()
    .listUserQuestions()
    .catch(() => [])
  return mergeQuestions([...BUILT_IN_QUESTIONS], userQuestions).questions
}

/** 문제 키 → 문제 (회차의 questionRefs로 문제를 찾을 때) */
export function indexByRef(questions: readonly AnyQuestion[]): Map<QuestionRef, AnyQuestion> {
  return new Map(questions.map((q) => [refOf(q), q]))
}

/**
 * 출제 후보 → 실제 문제 (T4-7)
 * 변형 문제는 시드가 없으면 새로 뽑아 만든다. 같은 시드가 겹치지 않게 한다.
 * 처음에는 템플릿 코드·SQL 실행기를 불러오므로 시간이 조금 걸린다.
 */
export async function resolvePracticeItems(items: readonly PracticeItem[]): Promise<AnyQuestion[]> {
  const used = new Set<QuestionRef>()
  const out: AnyQuestion[] = []
  for (const item of items) {
    if (item.kind === 'fixed') {
      out.push(item.question)
      continue
    }
    let seed = item.seed ?? randomSeed()
    while (item.seed === undefined && used.has(`${item.template.id}#${seed}`)) seed = randomSeed()
    const q = await generateTemplateQuestion(item.template.id, seed)
    if (!q) continue // 없어진 템플릿은 건너뛴다
    used.add(refOf(q))
    out.push(q)
  }
  return out
}

/**
 * 회차의 문제 키 → 문제 (T4-7)
 * 고정 문제는 목록에서 찾고, 변형 문제("TP03#12345")는 같은 시드로 다시 만든다 → 항상 같은 문제.
 * 찾을 수 없는 키(지워진 문제·없어진 템플릿)는 결과에서 빠진다.
 */
export async function loadSessionQuestions(
  refs: readonly QuestionRef[],
  fixed: readonly Question[],
): Promise<Map<QuestionRef, AnyQuestion>> {
  const map = indexByRef(fixed)
  for (const ref of refs) {
    if (map.has(ref)) continue
    let parsed: ReturnType<typeof parseRef>
    try {
      parsed = parseRef(ref)
    } catch {
      continue // 깨진 키
    }
    if (parsed.kind !== 'template') continue
    const q = await generateTemplateQuestion(parsed.templateId, parsed.seed).catch(() => undefined)
    if (q) map.set(ref, q)
  }
  return map
}

/**
 * 문제 키 → 과목·단원·주제 (오답노트·통계용, T6-1·T6-4)
 * 변형 문제는 문제를 다시 만들지 않고 템플릿 정보 목록으로 찾는다 (가볍게).
 * 찾을 수 없는 키(지워진 문제·깨진 키)는 undefined.
 */
export function questionInfoResolver(
  questions: readonly Question[],
): (ref: QuestionRef) => WrongNoteInfo | undefined {
  const fixed = new Map(questions.map((q) => [q.id, q]))
  const templates = new Map(TEMPLATE_INFO.map((t) => [t.id, t]))
  return (ref) => {
    const q = fixed.get(ref)
    if (q) return { subject: q.subject, chapter: q.chapter, topic: q.topic, variant: false }
    try {
      const parsed = parseRef(ref)
      const t = parsed.kind === 'template' ? templates.get(parsed.templateId) : undefined
      return t && { subject: t.subject, chapter: t.chapter, topic: t.topic, variant: true }
    } catch {
      return undefined
    }
  }
}
