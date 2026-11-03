import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import {
  DEFAULT_PRACTICE_SETTINGS,
  PRACTICE_SETTINGS_KEY,
  parseRef,
  pickPracticeItems,
  practiceItems,
  summarizeAttempts,
  type Attempt,
  type PracticeSettings,
} from '../src/domain'
import { TEMPLATE_INFO, generateTemplateQuestion, setSqlEngineLoader } from '../src/engine'
import { TEMPLATES } from '../src/engine/templates'
import { createIndexedDbStorage, setStorage, type StorageAdapter } from '../src/storage'
import { loadSessionQuestions, resolvePracticeItems } from '../src/pages/Practice/loadQuestions'
import { useNodeSqlEngine } from './helpers/nodeSqlEngine'

beforeAll(() => useNodeSqlEngine())
afterAll(() => setSqlEngineLoader(undefined))
afterEach(() => setStorage(undefined))

const fixed = [...BUILT_IN_QUESTIONS]
const settings = (over: Partial<PracticeSettings> = {}): PracticeSettings => ({ ...DEFAULT_PRACTICE_SETTINGS, ...over })
const attempt = (questionRef: string, correct: boolean, at = '2026-11-03T10:00:00.000Z'): Attempt => ({
  id: `${questionRef}-${at}`,
  questionRef,
  sessionId: 's',
  mode: 'practice',
  chosen: 1,
  correct,
  elapsedSec: 10,
  at,
})

describe('T4-7 템플릿 정보 목록', () => {
  it('가벼운 정보 목록(TEMPLATE_INFO)이 실제 템플릿과 일치한다', () => {
    const real = TEMPLATES.map(({ id, subject, chapter, topic, type, difficulty }) => ({ id, subject, chapter, topic, type, difficulty }))
    expect(TEMPLATE_INFO).toEqual(real)
  })
})

describe('T4-7 출제 후보에 변형 문제 섞기', () => {
  const kinds = (items: ReturnType<typeof practiceItems>) =>
    items.map((i) => (i.kind === 'fixed' ? i.question.id : `${i.template.id}${i.seed === undefined ? '' : `#${i.seed}`}`))

  it('조건에 맞는 템플릿마다 3문제 몫이 들어간다', () => {
    expect(kinds(practiceItems(fixed, TEMPLATE_INFO, settings({ chapters: ['S1-04'] }), new Map()))).toEqual([
      'S1-04-0001',
      'TP01',
      'TP01',
      'TP01',
    ])
    // 유형으로도 거른다: 시나리오형 = 고정 S3-02 + TP10
    expect(kinds(practiceItems(fixed, TEMPLATE_INFO, settings({ types: ['scenario'] }), new Map()))).toEqual([
      'S3-02-0001',
      'TP10',
      'TP10',
      'TP10',
    ])
  })

  it('"변형 문제 포함"을 끄거나 1과목만 고르면 변형 문제가 없다', () => {
    expect(practiceItems(fixed, TEMPLATE_INFO, settings({ includeTemplates: false }), new Map()).every((i) => i.kind === 'fixed')).toBe(true)
    expect(practiceItems(fixed, TEMPLATE_INFO, settings({ subjects: [1] }), new Map()).every((i) => i.kind === 'fixed')).toBe(true)
  })

  it('안 푼 문제만: 변형 문제는 매번 새로 만들어지므로 항상 포함', () => {
    const stats = summarizeAttempts([attempt('TP01#5', true)])
    expect(kinds(practiceItems(fixed, TEMPLATE_INFO, settings({ chapters: ['S1-04'], progress: 'unsolved' }), stats))).toEqual([
      'S1-04-0001',
      'TP01',
      'TP01',
      'TP01',
    ])
  })

  it('틀린 문제만: 최근에 틀린 "템플릿ID#시드"를 그대로 다시 낸다', () => {
    const stats = summarizeAttempts([
      attempt('TP03#77', false),
      attempt('TP03#88', false),
      attempt('TP03#88', true, '2026-11-03T11:00:00.000Z'), // 나중에 맞힘 → 제외
      attempt('TP99#1', false), // 없는 템플릿 → 제외
      attempt('TP01#3', false), // 조건(S1-05) 밖 → 제외
    ])
    expect(kinds(practiceItems(fixed, TEMPLATE_INFO, settings({ chapters: ['S1-05'], progress: 'wrong' }), stats))).toEqual(['TP03#77'])
  })

  it('문항 수만큼 자른다', () => {
    expect(pickPracticeItems(fixed, TEMPLATE_INFO, settings({ count: 10 }), new Map())).toHaveLength(10)
    expect(pickPracticeItems(fixed, TEMPLATE_INFO, settings({ count: 'all' }), new Map())).toHaveLength(fixed.length + TEMPLATE_INFO.length * 3)
  })
})

describe('T4-7 변형 문제 만들기·다시 만들기', () => {
  it('후보 → 문제: 같은 템플릿 3개는 서로 다른 시드, 정해진 시드는 그대로', async () => {
    const tp01 = TEMPLATE_INFO[0]!
    const qs = await resolvePracticeItems([
      { kind: 'fixed', question: fixed[0]! },
      { kind: 'template', template: tp01 },
      { kind: 'template', template: tp01 },
      { kind: 'template', template: tp01 },
      { kind: 'template', template: tp01, seed: 42 },
    ])
    expect(qs).toHaveLength(5)
    expect(qs[0]).toBe(fixed[0])
    const seeds = qs.slice(1).map((q) => ('seed' in q ? q.seed : -1))
    expect(new Set(seeds).size).toBe(4)
    expect(seeds[3]).toBe(42)
  })

  it('회차의 키로 같은 문제를 다시 만든다, 깨진 키·없는 템플릿은 건너뛴다', async () => {
    const original = (await generateTemplateQuestion('TP07', 2026))!
    const map = await loadSessionQuestions(['S1-04-0001', 'TP07#2026', 'TP99#1', 'TP01#abc'], fixed)
    expect(map.get('TP07#2026')).toEqual(original)
    expect(map.get('S1-04-0001')).toMatchObject({ id: 'S1-04-0001' })
    expect(map.has('TP99#1')).toBe(false)
    expect(map.has('TP01#abc')).toBe(false)
  })
})

// ───────────── 화면 흐름 (진짜 sql.js) ─────────────

let n = 0
async function storageWith(over: Partial<PracticeSettings>): Promise<StorageAdapter> {
  const storage = createIndexedDbStorage(`tpl-int-${++n}`)
  // 순서 고정(문제·보기 섞기 끔) → 화면에서 원래 번호로 누를 수 있다
  await storage.setMeta(PRACTICE_SETTINGS_KEY, settings({ shuffle: false, shuffleChoices: false, count: 'all', ...over }))
  setStorage(storage)
  return storage
}

const renderAt = (path: string) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </ThemeProvider>,
  )
const choice = (no: number) => within(screen.getByRole('list', { name: '보기' })).getAllByRole('button')[no - 1]!

describe('T4-7 연습 화면에서 변형 문제', () => {
  it('설정 화면에 "변형 N종"과 변형 문제 수가 보인다', async () => {
    await storageWith({ chapters: ['S1-04'] })
    renderAt('/practice')
    await screen.findByRole('button', { name: '연습 시작' })
    // 숫자가 <strong>으로 나뉘어 있어 문장 전체 글자로 확인
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent(
      '조건에 맞는 문제 4개 (변형 문제 3개 포함) → 이번에 4문제',
    )
    const row = screen.getByText('S1-04 WHERE절').closest('label')!
    expect(row).toHaveTextContent('1문제 · 변형 1종')
  })

  it('시작 → 변형 문제 풀기(배지·기록 키) → 새로고침해도 같은 문제 → 끝내면 점수에 포함', async () => {
    const storage = await storageWith({ chapters: ['S1-04'] })
    renderAt('/practice')
    fireEvent.click(await screen.findByRole('button', { name: '연습 시작' }))
    await screen.findByText('문제 1 / 4', {}, { timeout: 5000 })

    const [session] = await storage.listSessions()
    expect(session!.questionRefs[0]).toBe('S1-04-0001')
    const variantRefs = session!.questionRefs.slice(1)
    expect(variantRefs.every((r) => /^TP01#\d+$/.test(r))).toBe(true)

    // 2번 문제(변형)로 이동
    fireEvent.click(screen.getByRole('button', { name: '다음 ▶' }))
    await screen.findByText('문제 2 / 4')
    expect(screen.getByText('변형 문제')).toBeInTheDocument()
    const ref = variantRefs[0]!
    const parsed = parseRef(ref)
    const q = (await generateTemplateQuestion('TP01', parsed.kind === 'template' ? parsed.seed : 0))!
    const sqlShown = document.querySelector('pre')?.textContent

    fireEvent.click(choice(q.answer))
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(screen.getByRole('status')).toHaveTextContent('정답입니다')
    await waitFor(async () => expect(await storage.listAttempts()).toHaveLength(1))
    expect((await storage.listAttempts())[0]).toMatchObject({ questionRef: ref, correct: true })

    // 새로고침 → 같은 문제(같은 SQL·같은 보기), 채점 상태 유지
    cleanup()
    renderAt(`/practice/${session!.id}`)
    await screen.findByText('문제 2 / 4', {}, { timeout: 5000 })
    expect(document.querySelector('pre')?.textContent).toBe(sqlShown)
    expect(choice(q.answer)).toHaveTextContent('정답 · 내 답')

    // 끝내기 → 변형 문제도 점수에 들어간다
    fireEvent.click(screen.getByRole('button', { name: '다음 ▶' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 ▶' }))
    fireEvent.click(screen.getByRole('button', { name: '끝내기' }))
    fireEvent.click(screen.getByRole('button', { name: '끝내고 결과 보기' }))
    expect(screen.getByText('1문제 중 1개 정답 (100%)')).toBeInTheDocument()
    await waitFor(async () => expect((await storage.getSession(session!.id))?.score).toBe(1))
  })

  it('틀린 변형 문제만 다시 풀기: 같은 시드의 문제가 다시 나온다', async () => {
    const storage = await storageWith({ chapters: ['S2-05'], progress: 'wrong' })
    await storage.addAttempt(attempt('TP09#31337', false))
    renderAt('/practice')
    fireEvent.click(await screen.findByRole('button', { name: '연습 시작' }))
    await screen.findByText('문제 1 / 1', {}, { timeout: 5000 })
    const [session] = await storage.listSessions()
    expect(session!.questionRefs).toEqual(['TP09#31337'])
    const q = (await generateTemplateQuestion('TP09', 31337))!
    expect(document.querySelector('pre')?.textContent).toBe(q.sql)
  })
})
