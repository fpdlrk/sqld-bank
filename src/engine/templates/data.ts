/**
 * 템플릿 공통 데이터 도우미 (T4-4)
 * docs/04 §7: 행 5~12, 컬럼 3~5, 작고 읽기 쉬운 숫자.
 */
import type { Rng } from '../rng'

/** 사원 이름 후보 (모두 대문자 — SQLite LIKE는 대소문자를 구분하지 않으므로 소문자를 섞지 않는다) */
export const NAMES = [
  'KIM', 'LEE', 'PARK', 'CHOI', 'JUNG', 'KANG', 'CHO', 'YOON', 'JANG', 'LIM',
  'HAN', 'OH', 'SEO', 'SHIN', 'KWON', 'HWANG', 'AHN', 'SONG', 'YOO', 'HONG',
  'JEON', 'KO', 'MOON', 'YANG', 'SON', 'BAE', 'BAEK', 'HEO', 'NAM', 'NOH',
  'HA', 'MA', 'AN', 'MIN', 'NA', 'BANG', 'GO', 'WOO', 'JIN', 'PYO',
] as const

export const DEPT_NAMES: Record<number, string> = {
  10: 'SALES',
  20: 'DEV',
  30: 'HR',
  40: 'OPS',
  50: 'QA',
}

/** 서로 다른 이름 n개 */
export function pickNames(rng: Rng, n: number): string[] {
  return rng.shuffle(NAMES).slice(0, n)
}

/** 100 단위 급여 */
export function salary(rng: Rng, min = 800, max = 4000): number {
  return rng.int(min / 100, max / 100) * 100
}

/** 0 ~ n-1 중 서로 다른 k개 위치 */
export function pickIndexes(rng: Rng, n: number, k: number): Set<number> {
  return new Set(rng.shuffle([...Array(n).keys()]).slice(0, k))
}

/** 정답 근처의 "N건" 보충 후보 (0 ~ max) — 정답 ±1, ±2 … 순서 */
export function countFillers(answer: number, max: number): string[] {
  const out: string[] = []
  for (let d = 1; d <= max + 1; d++) {
    for (const v of [answer + d, answer - d]) if (v >= 0 && v <= max) out.push(`${v}건`)
  }
  return out
}

/** 정답 보기("3건")를 보고 근처 건수를 보충 후보로 — TemplateScenario.fillers에 넣는다 */
export const nearCounts =
  (max: number) =>
  (answerText: string): string[] =>
    countFillers(Number.parseInt(answerText, 10) || 0, max)
