/**
 * TP05 (S2-02) 집합 연산자 결과 건수 — docs/04 §7
 * UNION / UNION ALL / INTERSECT / MINUS
 * 실행: Oracle의 MINUS → SQLite의 EXCEPT (docs/04 §6). 둘 다 중복을 제거한다.
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TrapProbe } from '../template'
import type { Rng } from '../rng'
import { nearCounts } from './data'

type SetOp = 'UNION' | 'UNION ALL' | 'INTERSECT' | 'MINUS'
const OPS: SetOp[] = ['UNION', 'UNION ALL', 'INTERSECT', 'MINUS']

const exec = (op: SetOp) => (op === 'MINUS' ? 'EXCEPT' : op)
const probe = (op: SetOp, first = 'A', second = 'B') => ({
  sql: `SELECT CODE FROM ${first} ${exec(op)} SELECT CODE FROM ${second}`,
  format: format.count,
})

const WHY: Record<SetOp, string> = {
  UNION: '중복을 제거하는 UNION으로 계산한',
  'UNION ALL': '중복을 그대로 두는 UNION ALL로 계산한',
  INTERSECT: '양쪽에 모두 있는 값만 남기는 INTERSECT로 계산한',
  MINUS: '첫 번째 결과에서 두 번째 결과를 빼는 MINUS로 계산한',
}

const MEANING: Record<SetOp, string> = {
  UNION: '두 결과를 합친 뒤 중복을 제거합니다',
  'UNION ALL': '두 결과를 중복까지 그대로 이어 붙입니다',
  INTERSECT: '양쪽 결과에 모두 있는 값만 남기고 중복을 제거합니다',
  MINUS: '첫 번째 결과에서 두 번째 결과에 있는 값을 빼고 중복을 제거합니다',
}

/** 읽는 소리에 맞춘 조사: 유니온(은), 유니온 올(은), 인터섹트(는), 마이너스(는) */
const PARTICLE: Record<SetOp, string> = { UNION: '은', 'UNION ALL': '은', INTERSECT: '는', MINUS: '는' }

/** 중복이 섞인 코드 목록 (같은 값이 한 테이블 안에 2번 이상 나오도록) */
function codes(rng: Rng): string[] {
  const pool = ['A', 'B', 'C', 'D', 'E', 'F']
  const n = rng.int(5, 7)
  const out = Array.from({ length: n - 1 }, () => rng.pick(pool))
  out.push(out[0] ?? 'A') // 중복 하나는 반드시
  return rng.shuffle(out)
}

const toRows = (vals: string[]): CellValue[][] => vals.map((v, i) => [i + 1, v])

/** 중복을 남긴 채 계산하는 잘못된 INTERSECT / MINUS (JS로 계산) */
function bagCount(op: 'INTERSECT' | 'MINUS', a: string[], b: string[]): number {
  const inB = new Set(b)
  return a.filter((v) => (op === 'INTERSECT' ? inB.has(v) : !inB.has(v))).length
}

export const TP05 = defineTemplate({
  id: 'TP05',
  subject: 2,
  chapter: 'S2-02',
  topic: '집합 연산자 결과 건수',
  type: 'sql_result',
  difficulty: 2,
  tags: ['UNION', 'UNION ALL', 'INTERSECT', 'MINUS', '집합 연산자'],
  numericChoices: true,
  build(rng) {
    const a = codes(rng)
    const b = codes(rng)
    const op = rng.pick(OPS)

    const traps: TrapProbe[] =
      op === 'INTERSECT'
        ? [
            { text: `${bagCount('INTERSECT', a, b)}건`, why: 'INTERSECT가 중복을 제거한다는 점을 놓친' },
            { ...probe('UNION'), why: WHY.UNION },
            { ...probe('MINUS'), why: WHY.MINUS },
          ]
        : op === 'MINUS'
          ? [
              { text: `${bagCount('MINUS', a, b)}건`, why: 'MINUS가 중복을 제거한다는 점을 놓친' },
              { ...probe('MINUS', 'B', 'A'), why: 'MINUS의 앞뒤 순서를 바꿔 계산한' },
              { ...probe('INTERSECT'), why: WHY.INTERSECT },
            ]
          : OPS.filter((o) => o !== op).map((o) => ({ ...probe(o), why: WHY[o] }))

    return {
      tables: [
        { name: 'A', columns: ['NO', 'CODE'], rows: toRows(a) },
        { name: 'B', columns: ['NO', 'CODE'], rows: toRows(b) },
      ],
      stem: '다음 [A], [B] 테이블에 SQL을 실행했을 때 결과 행의 수는?',
      sql: `SELECT CODE FROM A\n${op}\nSELECT CODE FROM B;`,
      // 해설의 실행 결과 표가 읽기 쉽도록 CODE 순으로 정렬 (건수는 같다)
      answer: {
        sql: `SELECT CODE FROM (SELECT CODE FROM A ${exec(op)} SELECT CODE FROM B) ORDER BY CODE`,
        format: format.count,
      },
      traps,
      fillers: nearCounts(a.length + b.length),
      explain: ({ answerMark, answerText }) =>
        `정답은 ${answerMark}(${answerText})입니다. ${op}${PARTICLE[op]} ${MEANING[op]}. [A]의 CODE는 (${a.join(', ')}), [B]의 CODE는 (${b.join(', ')})입니다. UNION ALL을 뺀 나머지 집합 연산자(UNION, INTERSECT, MINUS)는 모두 결과에서 중복 행을 제거한다는 점을 기억하세요.`,
      examPoint: 'UNION ALL만 중복을 남긴다 — UNION·INTERSECT·MINUS는 중복을 제거한다.',
    }
  },
})
