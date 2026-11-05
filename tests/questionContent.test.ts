import { describe, it, expect } from 'vitest'
import { CHAPTERS, CHOICE_MARKS, type Question } from '../src/domain'

/**
 * 문제 콘텐츠 검사 (Phase 8)
 * 스키마 검사(questions.test.ts)·정답 실행 검증(questions-sql.test.ts)과 별도로,
 * docs/04 §3·§4의 콘텐츠 규칙과 Phase 8 목표 문항 수를 확인한다.
 */
const all = Object.values(
  import.meta.glob<Question[]>('/src/data/questions/*.json', { eager: true, import: 'default' }),
).flat()
const byChapter = (code: string) => all.filter((q) => q.chapter === code)
const partOf = (code: string) => code.slice(0, 2)

/** Phase 8 Task별 목표 (docs/03) — 완료한 Task만 적는다. 기존 샘플 문제는 목표 수에 더해진다. */
const PART_TARGETS: { task: string; chapters: string[]; added: number }[] = [
  { task: 'T8-1', chapters: ['M1-01', 'M1-02', 'M1-03', 'M1-04', 'M1-05'], added: 35 },
  { task: 'T8-2', chapters: ['M2-01', 'M2-02', 'M2-03', 'M2-04', 'M2-05'], added: 25 },
  { task: 'T8-3', chapters: ['S1-01', 'S1-02', 'S1-03', 'S1-04', 'S1-05', 'S1-06', 'S1-07', 'S1-08', 'S2-01', 'S2-02', 'S2-03', 'S2-04', 'S2-05', 'S2-06', 'S2-07', 'S2-08', 'S3'], added: 25 },
  { task: 'T8-4', chapters: ['S1-05', 'S1-06', 'S1-07', 'S1-08', 'S2-01', 'S2-02', 'S2-03', 'S2-04', 'S2-05', 'S2-06', 'S2-07', 'S2-08', 'S3'], added: 30 },
  { task: 'T8-5', chapters: ['S2-01', 'S2-02', 'S2-03', 'S2-04', 'S2-05', 'S2-06', 'S2-07', 'S2-08', 'S3'], added: 25 },
  { task: 'T8-6', chapters: ['S2-04', 'S2-05', 'S2-06', 'S2-07', 'S2-08', 'S3'], added: 30 },
  { task: 'T8-7', chapters: ['S3-01', 'S3-02', 'S3-03', 'S3-04'], added: 30 },
]

/** Phase 8-2 단원별 목표 (docs/03): 비중 0→12, 1→15, 2→24, 3→30, 4→36 */
const CHAPTER_TARGET_BY_WEIGHT: Record<number, number> = { 0: 12, 1: 15, 2: 24, 3: 30, 4: 36 }
/** 2차 보강을 마친 파트 — Task가 끝날 때마다 추가한다 */
const PHASE_8_2_DONE: string[] = ['M1', 'M2', 'S1-01', 'S1-02', 'S1-03', 'S1-04', 'S1-05', 'S1-06', 'S1-07', 'S1-08', 'S2-01', 'S2-02', 'S2-03', 'S2-04', 'S2-05', 'S2-06', 'S2-07', 'S2-08', 'S3']

describe('Phase 8-2 단원별 목표 문항 수', () => {
  const done = CHAPTERS.filter((c) => PHASE_8_2_DONE.some((p) => c.code.startsWith(p)))
  it.each(done.map((c) => [c.code, CHAPTER_TARGET_BY_WEIGHT[c.examWeight] ?? 0] as const))('%s: %i문제 이상', (code, target) => {
    expect(byChapter(code).length).toBeGreaterThanOrEqual(target)
  })
})

describe('Phase 8 목표 문항 수', () => {
  it('고정 문제 200개 이상, 모든 단원에 문제가 있다', () => {
    expect(all.length).toBeGreaterThanOrEqual(200)
    expect(CHAPTERS.filter((c) => byChapter(c.code).length === 0).map((c) => c.code)).toEqual([])
  })

  it.each(PART_TARGETS.map((t) => [t.task, t] as const))('%s', (_task, t) => {
    const count = all.filter((q) => t.chapters.includes(q.chapter)).length
    expect(count).toBeGreaterThanOrEqual(t.added)
  })
})

describe('단원별 구성 (docs/04 §3)', () => {
  const filled = CHAPTERS.filter((c) => byChapter(c.code).length >= 6)

  it.each(filled.map((c) => [c.code] as const))('%s: 유형 3가지 이상, 난이도 1·2가 모두 있음', (code) => {
    const qs = byChapter(code)
    expect(new Set(qs.map((q) => q.type)).size).toBeGreaterThanOrEqual(3)
    const diffs = new Set(qs.map((q) => q.difficulty))
    expect(diffs.has(1) && diffs.has(2)).toBe(true)
  })

  it('1과목 문제에는 SQL 결과형이 섞이지 않는다 (개념·모델링 중심)', () => {
    const sqlTypes = ['sql_result', 'sql_error', 'sql_equivalent', 'sql_fill']
    const m1 = all.filter((q) => partOf(q.chapter) === 'M1' || partOf(q.chapter) === 'M2')
    expect(m1.filter((q) => sqlTypes.includes(q.type)).map((q) => q.id)).toEqual([])
  })
})

describe('해설 형식 (docs/04 §4)', () => {
  it.each(all.map((q) => [q.id, q] as const))('%s', (_id, q) => {
    // 첫 문단(정답·이유) + 개념 설명 + 오답 설명 → 최소 3문단
    expect(q.explanation.split('\n\n').length).toBeGreaterThanOrEqual(3)
    // ①~④는 보기 번호에만: 뒤에 "번 행" 같은 다른 용도가 붙지 않는다
    expect(q.explanation).not.toMatch(/[①②③④]\s*(번\s*행|단계)/)
    expect(q.examPoint.length).toBeGreaterThan(10)
    // 보기 문장이 다른 보기를 가리키면 섞으면 안 된다 (docs/04 §5)
    if (q.choices.some((c) => /[①②③④]/.test(c))) expect(q.fixedOrder).toBe(true)
    // 첫 문장의 "정답은 X"가 정답 번호와 같다
    expect(q.explanation.startsWith(`정답은 ${CHOICE_MARKS[q.answer]}`)).toBe(true)
    // 조사: ①(일)·③(삼)은 받침 있음 → 은/이/을/과, ②(이)·④(사)는 받침 없음 → 는/가/를/와
    for (const text of [q.explanation, q.examPoint]) {
      expect(text).not.toMatch(/[①③][는가를와][\s,.)]/)
      expect(text).not.toMatch(/[②④][은이을과][\s,.)]/)
      // 보기는 4개뿐: ⑤ 이상의 번호를 쓰지 않는다
      expect(text).not.toMatch(/[⑤⑥⑦⑧⑨⑩]/)
    }
  })
})
