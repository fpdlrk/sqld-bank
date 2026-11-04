import { describe, it, expect } from 'vitest'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import {
  CHAPTERS,
  buildExamPlan,
  createPracticeSession,
  recentExamRefs,
  type ChapterCode,
  type ExamPlan,
  type Question,
  type Session,
} from '../src/domain'
import { TEMPLATE_INFO } from '../src/engine'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

/** 가상 문제은행: 모든 단원에 perChapter개씩 */
function fakeBank(perChapter: number): Question[] {
  const base = BUILT_IN_QUESTIONS[0]!
  return CHAPTERS.flatMap((c) =>
    Array.from({ length: perChapter }, (_, i) => ({
      ...base,
      id: `${c.code}-${String(i + 1).padStart(4, '0')}`,
      chapter: c.code as ChapterCode,
      subject: c.subject,
    })),
  )
}

const countBy = (plan: ExamPlan, subject: 1 | 2) =>
  plan.items.filter((i) => (i.kind === 'fixed' ? i.question.subject : i.template.subject) === subject).length
const chapterOf = (i: ExamPlan['items'][number]) => (i.kind === 'fixed' ? i.question.chapter : i.template.chapter)
const fixedIds = (plan: ExamPlan) => plan.items.flatMap((i) => (i.kind === 'fixed' ? [i.question.id] : []))

describe('T5-2 출제기 — 문제가 충분할 때', () => {
  const bank = fakeBank(6)

  it('과목별 문항 수 10 / 40 보장 (시드 200개)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const plan = buildExamPlan(bank, TEMPLATE_INFO, { random: seeded(seed) })
      expect(countBy(plan, 1), `seed ${seed}`).toBe(10)
      expect(countBy(plan, 2), `seed ${seed}`).toBe(40)
      expect(plan.items).toHaveLength(50)
      expect(plan.shortage).toBe(0)
      expect(new Set(fixedIds(plan)).size).toBe(fixedIds(plan).length) // 같은 고정 문제 중복 없음
    }
  })

  it('단원별 문항 수 = 단원표 비중, 1과목 optional 단원은 정확히 하나만 1문항', () => {
    const plan = buildExamPlan(bank, TEMPLATE_INFO, { random: seeded(7) })
    for (const c of CHAPTERS) {
      const n = plan.items.filter((i) => chapterOf(i) === c.code).length
      if ('optional' in c && c.optional) expect([0, 1]).toContain(n)
      else expect(n, c.code).toBe(c.examWeight)
    }
    const optionalUsed = CHAPTERS.filter((c) => 'optional' in c && c.optional && plan.items.some((i) => chapterOf(i) === c.code))
    expect(optionalUsed).toHaveLength(1)
  })

  it('변형 문제는 2과목의 30% (12문항), 템플릿이 있는 단원에만', () => {
    const plan = buildExamPlan(bank, TEMPLATE_INFO, { random: seeded(3) })
    expect(plan.subjects[2].templates).toBe(12)
    expect(plan.subjects[1].templates).toBe(0)
    for (const i of plan.items) if (i.kind === 'template') expect(TEMPLATE_INFO.map((t) => t.chapter)).toContain(i.template.chapter)
  })

  it('변형 문제 비율을 바꿀 수 있다 (0% → 0개, 50% → 20개)', () => {
    expect(buildExamPlan(bank, TEMPLATE_INFO, { templateRatio: 0, random: seeded(1) }).subjects[2].templates).toBe(0)
    expect(buildExamPlan(bank, TEMPLATE_INFO, { templateRatio: 0.5, random: seeded(1) }).subjects[2].templates).toBe(20)
  })

  it('순서: 1과목 → 2과목, 과목 안에서는 단원 순', () => {
    const plan = buildExamPlan(bank, TEMPLATE_INFO, { random: seeded(11) })
    const order = CHAPTERS.map((c) => c.code as string)
    const idx = plan.items.map((i) => order.indexOf(chapterOf(i)))
    expect(idx).toEqual([...idx].sort((a, b) => a - b))
  })

  it('최근 모의고사에 나온 고정 문제는 후순위 — 남는 문제가 있으면 쓰지 않는다', () => {
    const first = buildExamPlan(bank, TEMPLATE_INFO, { random: seeded(5) })
    const recent = new Set(fixedIds(first))
    const second = buildExamPlan(bank, TEMPLATE_INFO, { recentRefs: recent, random: seeded(6) })
    // 단원마다 6문제라 비중 4 이하 단원은 모두 새 문제로 채울 수 있다
    const overlap = fixedIds(second).filter((id) => recent.has(id))
    expect(overlap).toEqual([])
  })

  it('같은 난수 → 같은 구성', () => {
    const a = buildExamPlan(bank, TEMPLATE_INFO, { random: seeded(9) })
    const b = buildExamPlan(bank, TEMPLATE_INFO, { random: seeded(9) })
    expect(a).toEqual(b)
  })
})

describe('T5-2 출제기 — 문제가 모자랄 때', () => {
  it('지금 문제은행(고정 12개): 1과목은 있는 만큼만 내고 부족을 알리고, 2과목은 변형 문제로 40을 채운다', () => {
    const plan = buildExamPlan([...BUILT_IN_QUESTIONS], TEMPLATE_INFO, { random: seeded(2) })
    const s1 = BUILT_IN_QUESTIONS.filter((q) => q.subject === 1).length
    expect(plan.subjects[1]).toMatchObject({ target: 10, planned: s1, missing: 10 - s1 })
    expect(plan.subjects[2]).toMatchObject({ target: 40, planned: 40, missing: 0 })
    expect(plan.shortage).toBe(10 - s1)
    // 2과목 고정 문제 8개는 모두 쓰인다
    expect(fixedIds(plan).filter((id) => !id.startsWith('M'))).toHaveLength(BUILT_IN_QUESTIONS.filter((q) => q.subject === 2).length)
  })

  it('단원이 모자라면 같은 과목 다른 단원의 고정 문제로 채운다 (변형 문제가 없는 1과목)', () => {
    // 1과목: M1-01에만 20문제
    const base = BUILT_IN_QUESTIONS[0]!
    const bank: Question[] = Array.from({ length: 20 }, (_, i) => ({ ...base, id: `M1-01-${String(i + 1).padStart(4, '0')}`, chapter: 'M1-01' as const, subject: 1 as const }))
    const plan = buildExamPlan(bank, TEMPLATE_INFO, { random: seeded(4) })
    expect(plan.subjects[1]).toMatchObject({ planned: 10, missing: 0 })
  })

  it('남는 새 문제가 없으면 최근에 나온 문제도 쓴다', () => {
    const bank = fakeBank(1)
    const allIds = new Set(bank.map((q) => q.id))
    const plan = buildExamPlan(bank, TEMPLATE_INFO, { recentRefs: allIds, random: seeded(8) })
    expect(plan.subjects[1].planned).toBe(10)
  })
})

describe('T5-2 최근 모의고사 문제', () => {
  it('최근 3회 모의고사(연습 제외)에 나온 문제 키', () => {
    const q = BUILT_IN_QUESTIONS
    const mk = (refs: Question[], at: string, mode: Session['mode'] = 'exam'): Session => ({
      ...createPracticeSession(refs),
      mode,
      startedAt: at,
    })
    const sessions = [
      mk([q[0]!], '2026-11-01T00:00:00Z'), // 4번째로 오래됨 → 제외
      mk([q[1]!], '2026-11-02T00:00:00Z'),
      mk([q[2]!], '2026-11-03T00:00:00Z'),
      mk([q[3]!], '2026-11-04T00:00:00Z'),
      mk([q[4]!], '2026-11-05T00:00:00Z', 'practice'), // 연습 → 제외
    ]
    expect([...recentExamRefs(sessions)].sort()).toEqual([q[1]!.id, q[2]!.id, q[3]!.id].sort())
  })
})
