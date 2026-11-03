import { describe, it, expect } from 'vitest'
import { MAX_SEED, createRng, normalizeSeed, randomSeed } from '../src/engine'

const take = (seed: number, n: number) => {
  const r = createRng(seed)
  return Array.from({ length: n }, () => r.next())
}

describe('T4-1 시드 난수', () => {
  it('같은 시드 → 같은 수열', () => {
    expect(take(42, 100)).toEqual(take(42, 100))
  })

  it('다른 시드 → 다른 수열', () => {
    expect(take(42, 10)).not.toEqual(take(43, 10))
  })

  it('고정값: 계산 방식이 바뀌면 예전 시드가 다른 문제를 만들게 되므로 값이 그대로여야 한다', () => {
    // 표준 mulberry32 구현과 같은 값
    expect(take(12345, 3)).toEqual([0.9797282677609473, 0.3067522644996643, 0.484205421525985])
    const r = createRng(2026)
    expect(Array.from({ length: 5 }, () => r.int(1, 100))).toEqual([46, 31, 67, 62, 16])
  })

  it('next는 0 이상 1 미만', () => {
    for (const v of take(7, 10_000)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('시드 정리: 음수·소수·큰 수도 0 ~ 2^32-1 정수로', () => {
    expect(normalizeSeed(3.9)).toBe(3)
    expect(normalizeSeed(-1)).toBe(MAX_SEED)
    expect(normalizeSeed(2 ** 32 + 5)).toBe(5)
    expect(take(-1, 5)).toEqual(take(MAX_SEED, 5))
    expect(() => normalizeSeed(Number.NaN)).toThrow()
  })
})

describe('T4-1 도우미 함수', () => {
  it('int: 양 끝 포함, 범위 안의 모든 값이 나온다', () => {
    const r = createRng(1)
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const v = r.int(-2, 3)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(-2)
      expect(v).toBeLessThanOrEqual(3)
      seen.add(v)
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2, 3])
    expect(r.int(5, 5)).toBe(5)
    expect(() => r.int(3, 1)).toThrow()
    expect(() => r.int(1.5, 3)).toThrow()
  })

  it('pick: 모든 항목이 고르게 나오고, 빈 배열은 오류', () => {
    const r = createRng(2)
    const counts = { A: 0, B: 0, C: 0 }
    for (let i = 0; i < 3000; i++) counts[r.pick(['A', 'B', 'C'] as const)]++
    for (const c of Object.values(counts)) expect(c).toBeGreaterThan(800)
    expect(() => r.pick([])).toThrow('빈 배열')
  })

  it('shuffle: 같은 항목, 원본 유지, 같은 시드면 같은 결과', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    const a = createRng(9).shuffle(src)
    expect([...a].sort((x, y) => x - y)).toEqual(src)
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(createRng(9).shuffle(src)).toEqual(a)
    expect(createRng(9).shuffle([])).toEqual([])
  })

  it('chance: 0이면 항상 false, 1이면 항상 true, 0.3이면 대략 30%', () => {
    const r = createRng(3)
    expect(Array.from({ length: 100 }, () => r.chance(0)).some(Boolean)).toBe(false)
    expect(Array.from({ length: 100 }, () => r.chance(1)).every(Boolean)).toBe(true)
    const hits = Array.from({ length: 10_000 }, () => r.chance(0.3)).filter(Boolean).length
    expect(hits).toBeGreaterThan(2700)
    expect(hits).toBeLessThan(3300)
  })

  it('nullable: 확률만큼 null, 아니면 값 그대로', () => {
    const r = createRng(4)
    expect(r.nullable(100, 0)).toBe(100)
    expect(r.nullable(100, 1)).toBeNull()
    const values = Array.from({ length: 1000 }, () => r.nullable('x', 0.5))
    expect(values.filter((v) => v === null).length).toBeGreaterThan(400)
    expect(values.filter((v) => v === 'x').length).toBeGreaterThan(400)
  })

  it('randomSeed: 0 ~ 2^32-1 정수, 매번 다름', () => {
    const seeds = Array.from({ length: 20 }, randomSeed)
    for (const s of seeds) {
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(MAX_SEED)
    }
    expect(new Set(seeds).size).toBeGreaterThan(15)
  })
})
