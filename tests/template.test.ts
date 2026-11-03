// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import initSqlJs from 'sql.js'
import type { GeneratedQuestion, TableData } from '../src/domain'
import {
  TemplateError,
  defineTemplate,
  format,
  setSqlEngineLoader,
  tableToMarkdown,
  withDatabase,
  type TemplateSpec,
} from '../src/engine'
import { demoTemplate } from '../src/pages/Dev/demoTemplate'

beforeAll(() => setSqlEngineLoader(() => initSqlJs()))
afterAll(() => setSqlEngineLoader(undefined))

const base: Omit<TemplateSpec, 'build'> = {
  id: 'TEST',
  subject: 2,
  chapter: 'S1-04',
  topic: '테스트',
  type: 'sql_result',
  difficulty: 1,
}
const T: TableData = { name: 'T', columns: ['V'], rows: [[1], [2], [3], [4], [5]] }
const explain = () => '첫 문단.'

/** 공통 확인: 보기 4개 서로 다름, 정답 1~4 */
function expectWellFormed(q: GeneratedQuestion) {
  expect(new Set(q.choices).size).toBe(4)
  expect([1, 2, 3, 4]).toContain(q.answer)
}

describe('T4-3 견본 템플릿 (시드 200개)', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => i * 7919 + 1)

  it('보기 4개가 항상 서로 다르고, 정답 보기가 실제 실행 결과와 같다', async () => {
    for (const seed of seeds) {
      const q = await demoTemplate.generate(seed)
      expectWellFormed(q)
      const rows = await withDatabase(q.tables ?? [], (db) => db.query(q.sql ?? ''))
      expect(q.choices[q.answer - 1], `seed ${seed}`).toBe(`${rows.rows.length}건`)
      // 숫자 보기는 오름차순 고정
      const nums = q.choices.map((c) => Number.parseInt(c, 10))
      expect(nums).toEqual([...nums].sort((a, b) => a - b))
      expect(q.fixedOrder).toBe(true)
    }
  })

  it('같은 시드 → 같은 문제, 다른 시드 → 대부분 다른 문제', async () => {
    expect(await demoTemplate.generate(42)).toEqual(await demoTemplate.generate(42))
    const tables = new Set<string>()
    for (const s of seeds.slice(0, 30)) tables.add(JSON.stringify((await demoTemplate.generate(s)).tables))
    expect(tables.size).toBeGreaterThan(25)
  })

  it('템플릿 정보가 문제에 담긴다 (templateId·seed·단원)', async () => {
    const q = await demoTemplate.generate(5)
    expect(q).toMatchObject({ templateId: 'DEMO', seed: 5, chapter: 'S1-04', subject: 2, type: 'sql_result' })
  })

  it('해설: 첫 문단 → 실행 결과 표 → 오답 보기마다 이유', async () => {
    const q = await demoTemplate.generate(9)
    const [first, resultPart, traps] = q.explanation.split('\n\n실행 결과는 다음과 같습니다.\n\n').flatMap((p) => p.split(/\n\n(?=[①②③④])/))
    expect(first).toContain(`정답은 ${'①②③④'[q.answer - 1]}(${q.choices[q.answer - 1]})`)
    expect(resultPart).toMatch(/^\| EMPNO \| SAL \|\n\|---\|---\|/)
    // 오답 보기 3개 모두 설명이 있다
    for (let i = 0; i < 4; i++) {
      if (i + 1 === q.answer) continue
      expect(traps).toContain(`${'①②③④'[i]}(${q.choices[i]})은`)
    }
  })
})

describe('T4-3 프레임워크 규칙', () => {
  it('함정이 정답과 같아지면 데이터를 다시 만든다', async () => {
    let builds = 0
    const t = defineTemplate({
      ...base,
      numericChoices: true,
      build(rng) {
        builds++
        // 절반 확률로 함정 두 개가 정답과 같은 결과가 되는 데이터
        const k = rng.chance(0.5) ? 5 : 2
        return {
          tables: [T],
          stem: 's',
          answer: { sql: `SELECT * FROM T WHERE V <= ${k}`, format: format.count },
          traps: [
            { sql: `SELECT * FROM T WHERE V < ${k + (k === 5 ? 1 : 0)}`, format: format.count, why: 'a' },
            { sql: `SELECT * FROM T WHERE V <= ${k === 5 ? 5 : 3}`, format: format.count, why: 'b' },
            { sql: 'SELECT * FROM T', format: format.count, why: 'c' },
          ],
          explain,
          examPoint: 'p',
        }
      },
    })
    // k=2 → 정답 2건, 함정 1건·3건·5건 (성공) / k=5 → 함정이 모두 5건이라 다시 만들기
    for (let seed = 1; seed <= 20; seed++) {
      const q = await t.generate(seed)
      expectWellFormed(q)
      expect(q.choices[q.answer - 1]).toBe('2건')
    }
    expect(builds).toBeGreaterThan(20) // 다시 만든 적이 있다
  })

  it('20번 만들어도 안 되면 TemplateError', async () => {
    const t = defineTemplate({
      ...base,
      build: () => ({
        tables: [T],
        stem: 's',
        answer: { sql: 'SELECT COUNT(*) FROM T', format: format.scalar },
        traps: [
          { sql: 'SELECT COUNT(V) FROM T', format: format.scalar, why: '같음' },
          { text: '5', why: '같음' },
        ],
        explain,
        examPoint: 'p',
      }),
    })
    await expect(t.generate(1)).rejects.toThrow(TemplateError)
    await expect(t.generate(1)).rejects.toThrow('20번')
  })

  it('함정이 모자라면 보충 후보로 채우고, 보충 보기는 "계산 실수"로 설명', async () => {
    const t = defineTemplate({
      ...base,
      numericChoices: true,
      build: () => ({
        tables: [T],
        stem: 's',
        answer: { sql: 'SELECT * FROM T WHERE V >= 3', format: format.count }, // 3건
        traps: [
          { sql: 'SELECT * FROM T WHERE V > 3', format: format.count, why: '경계 제외' }, // 2건
          { text: '5건', why: '전체를 센' },
        ],
        fillers: ['3건', '2건', '4건', '1건'], // 3건·2건은 겹쳐서 건너뜀 → 4건
        explain,
        examPoint: 'p',
      }),
    })
    const q = await t.generate(1)
    expect(q.choices).toEqual(['2건', '3건', '4건', '5건'])
    expect(q.answer).toBe(2)
    expect(q.explanation).toContain('①(2건)은 경계 제외 경우의 결과입니다.')
    expect(q.explanation).toContain('③(4건)은 계산 실수를 노린 값입니다.')
    expect(q.explanation).toContain('④(5건)은 전체를 센 경우의 결과입니다.')
  })

  it('숫자 보기가 아니면 섞는다 — 정답 위치가 시드마다 달라진다', async () => {
    const t = defineTemplate({
      ...base,
      minTraps: 3,
      build: () => ({
        tables: [T],
        stem: 's',
        answer: { sql: "SELECT 'A'", format: format.scalar },
        traps: ['B', 'C', 'D'].map((x) => ({ text: x, why: x })),
        explain,
        examPoint: 'p',
      }),
    })
    const positions = new Set<number>()
    for (let seed = 1; seed <= 40; seed++) {
      const q = await t.generate(seed)
      expectWellFormed(q)
      expect(q.choices[q.answer - 1]).toBe('A')
      expect(q.fixedOrder).toBe(false)
      positions.add(q.answer)
    }
    expect(positions.size).toBe(4)
  })

  it('쿼리마다 새 DB — 정답 쿼리의 DELETE가 함정 쿼리에 영향을 주지 않는다', async () => {
    const t = defineTemplate({
      ...base,
      numericChoices: true,
      build: () => ({
        tables: [T],
        stem: 's',
        answer: { sql: 'DELETE FROM T WHERE V > 3; SELECT COUNT(*) FROM T', format: format.scalar }, // 3
        traps: [
          { sql: 'SELECT COUNT(*) FROM T', format: format.scalar, why: 'DELETE를 무시한' }, // 5
          { sql: 'DELETE FROM T WHERE V > 1; SELECT COUNT(*) FROM T', format: format.scalar, why: '조건을 착각한' }, // 1
          { text: '0', why: '모두 지운다고 본' },
        ],
        explain,
        examPoint: 'p',
      }),
    })
    const q = await t.generate(1)
    expect(q.choices).toEqual(['0', '1', '3', '5'])
    expect(q.answer).toBe(3)
  })

  it('실행용으로만 쓰는 숨은 테이블은 화면 테이블에 나오지 않는다', async () => {
    const t = defineTemplate({
      ...base,
      numericChoices: true,
      build: () => ({
        tables: [T],
        hiddenTables: [{ name: 'H', columns: ['X'], rows: [[10]] }],
        stem: 's',
        answer: { sql: 'SELECT X FROM H', format: format.scalar },
        traps: [
          { text: '20', why: 'a' },
          { text: '30', why: 'b' },
          { text: '40', why: 'c' },
        ],
        explain,
        examPoint: 'p',
      }),
    })
    const q = await t.generate(1)
    expect(q.tables?.map((x) => x.name)).toEqual(['T'])
    expect(q.choices[q.answer - 1]).toBe('10')
  })
})

describe('T4-3 도우미', () => {
  it('보기 글자 만들기', () => {
    const r: TableData = { columns: ['A', 'B'], rows: [[750, null], [1, 2]] }
    expect(format.count(r)).toBe('2건')
    expect(format.scalar(r)).toBe('750')
    expect(format.value(r)).toBe('750, NULL')
    expect(format.scalar({ columns: ['A'], rows: [] })).toBe('NULL')
  })

  it('결과 표 → Markdown 표 (0행은 "결과 없음")', () => {
    expect(tableToMarkdown({ columns: ['A', 'B'], rows: [[1, null]] })).toBe('| A | B |\n|---|---|\n| 1 | NULL |')
    expect(tableToMarkdown({ columns: ['A'], rows: [] })).toBe('| A |\n|---|\n| (결과 없음) |')
  })
})
