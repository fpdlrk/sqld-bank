/**
 * 시드 난수 생성기 (T4-1)
 *
 * 같은 시드 → 항상 같은 수열. 그래서 풀이 기록에 "템플릿ID#시드"만 저장해 두면
 * 나중에 똑같은 문제(같은 데이터, 같은 보기)를 다시 만들 수 있다.
 *
 * 알고리즘: mulberry32 (32비트 상태, 빠르고 분포가 고르다. 암호용은 아님)
 * ⚠ 이 파일의 계산 방식을 바꾸면 예전에 저장된 시드가 다른 문제를 만들게 된다.
 *   tests/rng.test.ts 의 "고정값" 테스트가 이를 막는다.
 */

/** 시드로 쓸 수 있는 정수 범위: 0 ~ 2^32-1 */
export const MAX_SEED = 0xffffffff

export interface Rng {
  /** 0 이상 1 미만 실수 */
  next(): number
  /** min 이상 max 이하 정수 (양 끝 포함) */
  int(min: number, max: number): number
  /** 배열에서 하나 */
  pick<T>(items: readonly T[]): T
  /** 섞은 새 배열 (원본은 그대로) */
  shuffle<T>(items: readonly T[]): T[]
  /** 확률 p(0~1)로 true */
  chance(p: number): boolean
  /** 확률 p로 null, 아니면 value — 예시 데이터에 NULL을 섞을 때 */
  nullable<T>(value: T, p: number): T | null
}

/** 아무 숫자나 시드로 받아 0 ~ 2^32-1 정수로 맞춘다 (음수·소수·큰 수 대비) */
export function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) throw new Error(`시드는 유한한 숫자여야 합니다: ${seed}`)
  return Math.trunc(seed) >>> 0
}

export function createRng(seed: number): Rng {
  let state = normalizeSeed(seed)

  // mulberry32 — 호출할 때마다 상태를 바꾸고 0 ~ 2^32-1 정수를 만든다
  function nextUint32(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }

  const next = () => nextUint32() / 4294967296

  const rng: Rng = {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
        throw new Error(`int(${min}, ${max}): 정수이고 min ≤ max 여야 합니다`)
      }
      return min + Math.floor(next() * (max - min + 1))
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick: 빈 배열에서는 고를 수 없습니다')
      return items[Math.floor(next() * items.length)] as (typeof items)[number]
    },
    shuffle(items) {
      // Fisher–Yates
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j] as (typeof out)[number], out[i] as (typeof out)[number]]
      }
      return out
    },
    chance(p) {
      if (p <= 0) return false
      if (p >= 1) return true
      return next() < p
    },
    nullable(value, p) {
      return rng.chance(p) ? null : value
    },
  }
  return rng
}

/** 새 문제를 만들 때 쓸 시드 하나 (시드 자체는 매번 달라야 하므로 일반 난수 사용) */
export function randomSeed(): number {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0] ?? Math.floor(Math.random() * MAX_SEED)
}
