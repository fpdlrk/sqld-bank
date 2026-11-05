import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import { AnswerFeedback } from '../src/components'
import {
  CHOICE_MARKS,
  DEFAULT_PRACTICE_SETTINGS,
  PRACTICE_SETTINGS_KEY,
  createPracticeSession,
  isValidChoiceOrder,
  makeChoiceOrder,
  remapChoiceMarks,
  type ChoiceNumber,
  type Question,
} from '../src/domain'
import { createIndexedDbStorage, setStorage } from '../src/storage'

const byId = (id: string) => BUILT_IN_QUESTIONS.find((q) => q.id === id) as Question

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

describe('T3-5 보기 순서 정하기', () => {
  it('fixedOrder 문제는 항상 원래 순서', () => {
    for (let i = 0; i < 20; i++) expect(makeChoiceOrder({ fixedOrder: true })).toEqual([1, 2, 3, 4])
  })

  it('섞은 순서는 1~4가 한 번씩, 같은 난수면 같은 순서, 여러 번 섞으면 여러 가지가 나온다', () => {
    const o = makeChoiceOrder({}, seeded(3))
    expect(isValidChoiceOrder(o)).toBe(true)
    expect(makeChoiceOrder({}, seeded(3))).toEqual(o)
    const seen = new Set(Array.from({ length: 50 }, (_, i) => makeChoiceOrder({}, seeded(i + 1)).join('')))
    expect(seen.size).toBeGreaterThan(5)
  })

  it('깨진 순서 판별', () => {
    expect(isValidChoiceOrder([1, 2, 3])).toBe(false)
    expect(isValidChoiceOrder([1, 1, 2, 3])).toBe(false)
    expect(isValidChoiceOrder('1234')).toBe(false)
    expect(isValidChoiceOrder(undefined)).toBe(false)
  })

  it('회차를 만들 때 문제별 순서를 저장 — fixedOrder는 원래 순서, 섞기 끄면 저장 안 함', () => {
    const qs = [byId('M1-01-0001'), byId('S1-04-0001')] // S1-04는 fixedOrder
    const s = createPracticeSession(qs, { random: seeded(9) })
    const orders = s.progress!.choiceOrders
    expect(isValidChoiceOrder(orders['M1-01-0001'])).toBe(true)
    expect(orders['S1-04-0001']).toEqual([1, 2, 3, 4])
    expect(createPracticeSession(qs, { shuffleChoices: false }).progress!.choiceOrders).toEqual({})
  })
})

describe('T3-5 해설 번호 바꾸기', () => {
  // 화면 ①=원래③, ②=원래①, ③=원래④, ④=원래②
  const order: ChoiceNumber[] = [3, 1, 4, 2]

  it('원래 번호 → 화면 번호', () => {
    expect(remapChoiceMarks('정답은 ③입니다. ①은 틀렸고 ②·④도 틀렸다.', order)).toBe(
      '정답은 ①입니다. ②는 틀렸고 ④·③도 틀렸다.', // 조사도 받침에 맞게 (②는)
    )
  })

  it('원래 순서이거나 순서가 깨졌으면 그대로', () => {
    const text = '정답은 ③입니다.'
    expect(remapChoiceMarks(text, [1, 2, 3, 4])).toBe(text)
    expect(remapChoiceMarks(text, [1, 2] as ChoiceNumber[])).toBe(text)
  })

  it('해설 화면에 바뀐 번호로 보인다', () => {
    const q = byId('S1-03-0001') // 해설: "정답은 ③(…"
    render(<AnswerFeedback question={q} chosen={1} order={order} />)
    expect(screen.getByRole('status')).toHaveTextContent('정답은 ①')
    expect(screen.getByText(/^정답은 ①\(750/)).toBeInTheDocument()
  })
})

describe('T3-5 문제 콘텐츠 규칙 (docs/04 §4, §5)', () => {
  it.each(BUILT_IN_QUESTIONS.map((q) => [q.id, q] as const))(
    '%s: 보기 문장에 ①~④가 있으면 fixedOrder, 해설의 "정답은 X"는 정답 번호와 일치',
    (_id, q) => {
      if (q.choices.some((c) => /[①②③④]/.test(c))) expect(q.fixedOrder).toBe(true)
      const m = /정답은\s*([①②③④])/.exec(q.explanation)
      if (m) expect(m[1]).toBe(CHOICE_MARKS[q.answer])
    },
  )
})

describe('T3-5 연습 화면에서 섞인 보기', () => {
  afterEach(() => setStorage(undefined))
  const renderAt = (path: string) =>
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </ThemeProvider>,
    )
  const buttons = () => within(screen.getByRole('list', { name: '보기' })).getAllByRole('button')

  it('저장된 순서로 보이고, 채점·기록은 원래 번호, 새로고침해도 같은 순서', async () => {
    const storage = createIndexedDbStorage('choice-order-run')
    setStorage(storage)
    const q = byId('M1-01-0001') // 정답 ①
    const base = createPracticeSession([q], { shuffleChoices: false })
    const session = { ...base, progress: { ...base.progress!, choiceOrders: { [q.id]: [4, 3, 2, 1] as ChoiceNumber[] } } }
    await storage.putSession(session)

    renderAt(`/practice/${session.id}`)
    await screen.findByText('문제 1 / 1')
    expect(buttons()[0]).toHaveTextContent(`①${q.choices[3]}`)
    expect(buttons()[3]).toHaveTextContent(`④${q.choices[0]}`)

    fireEvent.click(buttons()[3]!) // 화면 ④ = 원래 ① (정답)
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(screen.getByRole('status')).toHaveTextContent('정답입니다')
    await waitFor(async () => expect(await storage.listAttempts()).toHaveLength(1))
    expect((await storage.listAttempts())[0]).toMatchObject({ chosen: 1, correct: true })

    cleanup()
    renderAt(`/practice/${session.id}`)
    await screen.findByText('문제 1 / 1')
    expect(buttons()[0]).toHaveTextContent(q.choices[3])
    expect(buttons()[3]).toHaveTextContent('정답 · 내 답')
  })

  it('설정의 "보기 순서 섞기"가 켜져 있으면 회차에 순서가 저장된다', async () => {
    const storage = createIndexedDbStorage('choice-order-setup')
    await storage.setMeta(PRACTICE_SETTINGS_KEY, { ...DEFAULT_PRACTICE_SETTINGS, count: 'all', includeTemplates: false })
    setStorage(storage)
    renderAt('/practice')
    expect(await screen.findByRole('checkbox', { name: /보기 순서 섞기/ })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: '연습 시작' }))
    await screen.findByText(/^문제 1 \/ \d+$/)
    const [s] = await storage.listSessions()
    const orders = s!.progress!.choiceOrders
    expect(Object.keys(orders)).toHaveLength(BUILT_IN_QUESTIONS.length)
    for (const q of BUILT_IN_QUESTIONS) {
      expect(isValidChoiceOrder(orders[q.id])).toBe(true)
      if (q.fixedOrder) expect(orders[q.id]).toEqual([1, 2, 3, 4])
    }
  })
})
