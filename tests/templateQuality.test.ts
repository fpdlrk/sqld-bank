// @vitest-environment node
/**
 * T4-6 템플릿 품질 테스트 — 템플릿마다 시드 500개
 *   보기 4개 서로 다름 · 정답 1개 · 예외 없음 · 생성 시간 50ms 이하
 * 정답이 "맞는지"(SQL·JS 대조)는 tests/templates.test.ts 가 검사한다.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import initSqlJs from 'sql.js'
import { CHOICE_MARKS, type GeneratedQuestion } from '../src/domain'
import { MAX_SEED, loadSqlEngine, setSqlEngineLoader } from '../src/engine'
import { TEMPLATES } from '../src/engine/templates'

const SEEDS_PER_TEMPLATE = 500
const TIME_LIMIT_MS = 50

/** 0~99 + 경계값 + 넓게 흩어진 값 → 500개 */
const SEEDS: number[] = (() => {
  const seeds = new Set<number>([0, 1, MAX_SEED, MAX_SEED - 1, 2 ** 31, 2 ** 31 - 1])
  for (let i = 0; i < 100; i++) seeds.add(i)
  let x = 987654321
  while (seeds.size < SEEDS_PER_TEMPLATE) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    seeds.add(x)
  }
  return [...seeds]
})()

interface Report {
  questions: GeneratedQuestion[]
  errors: string[]
  times: number[]
}
const reports = new Map<string, Report>()

beforeAll(async () => {
  setSqlEngineLoader(() => initSqlJs())
  await loadSqlEngine() // WASM 로딩 시간은 생성 시간에서 뺀다

  for (const t of TEMPLATES) {
    const r: Report = { questions: [], errors: [], times: [] }
    await t.generate(123) // 첫 실행 준비(JIT) — 측정에서 제외
    for (const seed of SEEDS) {
      const started = performance.now()
      try {
        r.questions.push(await t.generate(seed))
      } catch (e) {
        r.errors.push(`seed ${seed}: ${e instanceof Error ? e.message : String(e)}`)
      }
      r.times.push(performance.now() - started)
    }
    reports.set(t.id, r)
  }

  // 결과 요약 (npm test 출력에 표로 보인다)
  console.table(
    TEMPLATES.map((t) => {
      const r = reports.get(t.id)!
      const sorted = [...r.times].sort((a, b) => a - b)
      return {
        template: t.id,
        ok: r.questions.length,
        errors: r.errors.length,
        'avg ms': +(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2),
        'p95 ms': +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(2),
        'max ms': +(sorted.at(-1) ?? 0).toFixed(2),
      }
    }),
  )
}, 300_000)

afterAll(() => setSqlEngineLoader(undefined))

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
}

describe.each(TEMPLATES.map((t) => [t.id]))(`T4-6 %s 품질 (시드 ${SEEDS_PER_TEMPLATE}개)`, (id) => {
  const report = () => reports.get(id)!

  it('예외 없이 모두 만들어진다', () => {
    expect(report().errors).toEqual([])
    expect(report().questions).toHaveLength(SEEDS_PER_TEMPLATE)
  })

  it('보기 4개가 서로 다르고 비어 있지 않으며, 정답은 정확히 1개', () => {
    for (const q of report().questions) {
      expect(q.choices).toHaveLength(4)
      expect(new Set(q.choices).size, `seed ${q.seed}: ${q.choices.join(' / ')}`).toBe(4)
      for (const c of q.choices) {
        expect(c.trim(), `seed ${q.seed}`).not.toBe('')
        expect(c.length, `seed ${q.seed}: 보기가 너무 김`).toBeLessThanOrEqual(120)
      }
      expect([1, 2, 3, 4]).toContain(q.answer)
      // 해설의 "정답은 X(…)"가 실제 정답 위치·글자와 일치 → 정답이 하나로 정해져 있다
      expect(q.explanation).toContain(`정답은 ${CHOICE_MARKS[q.answer]}(${q.choices[q.answer - 1]})`)
    }
  })

  it('해설의 ①~④는 보기를 가리킬 때만 쓰인다', () => {
    for (const q of report().questions) {
      expect(q.explanation, `seed ${q.seed}`).not.toMatch(/[①②③④](?!\()/)
      expect(q.stem + q.examPoint + (q.sql ?? '')).not.toMatch(/[①②③④]/)
    }
  })

  it('예시 테이블 모양이 올바르다 (이름 있음, 행마다 칸 수 = 컬럼 수)', () => {
    for (const q of report().questions) {
      expect(q.tables?.length ?? 0).toBeGreaterThan(0)
      for (const t of q.tables ?? []) {
        expect(t.name, `seed ${q.seed}`).toBeTruthy()
        for (const row of t.rows) expect(row, `seed ${q.seed} ${t.name}`).toHaveLength(t.columns.length)
      }
      expect(q.stem.trim()).not.toBe('')
      expect(q.examPoint.trim()).not.toBe('')
    }
  })

  it('같은 시드 → 같은 문제 (50개 다시 만들어 비교)', async () => {
    const t = TEMPLATES.find((x) => x.id === id)!
    for (const q of report().questions.filter((_, i) => i % 10 === 0)) {
      expect(await t.generate(q.seed)).toEqual(q)
    }
  })

  it(`생성 시간: 평균·95%가 ${TIME_LIMIT_MS}ms 이하 (최대값은 컴퓨터 부하로 튈 수 있어 200ms까지 허용)`, () => {
    const times = report().times
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    expect(avg).toBeLessThanOrEqual(TIME_LIMIT_MS)
    expect(percentile(times, 0.95)).toBeLessThanOrEqual(TIME_LIMIT_MS)
    expect(Math.max(...times)).toBeLessThanOrEqual(200)
  })

  it('데이터가 시드마다 충분히 다양하다 (서로 다른 예시 테이블 90% 이상)', () => {
    const distinct = new Set(report().questions.map((q) => JSON.stringify(q.tables)))
    expect(distinct.size).toBeGreaterThanOrEqual(SEEDS_PER_TEMPLATE * 0.9)
  })

  it('정답 위치가 한쪽으로 쏠리지 않는다 (섞는 템플릿은 각 위치 10% 이상)', () => {
    const qs = report().questions
    if (qs[0]?.fixedOrder) return // 숫자 보기(오름차순 고정)는 정답 위치가 값에 따라 정해짐
    const counts = [1, 2, 3, 4].map((n) => qs.filter((q) => q.answer === n).length)
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(qs.length * 0.1)
  })
})
