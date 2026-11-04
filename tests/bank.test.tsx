import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import { searchQuestions, type Question, type UserQuestion } from '../src/domain'
import { createIndexedDbStorage, setStorage } from '../src/storage'
import { BankQuestionList, PAGE_SIZE } from '../src/pages/Bank/BankQuestionList'

const QS = [...BUILT_IN_QUESTIONS] as Question[]
const byId = (id: string) => QS.find((q) => q.id === id)!

describe('T7-1 문제 검색', () => {
  it('빈 검색어면 전체', () => {
    expect(searchQuestions(QS, '  ')).toHaveLength(QS.length)
  })

  it('본문·주제·태그·ID·SQL에서 찾고, 대소문자 구분 없음', () => {
    expect(searchQuestions(QS, 's1-05-0001').map((q) => q.id)).toEqual(['S1-05-0001'])
    const tag = byId('S1-03-0001').tags![0]!
    expect(searchQuestions(QS, tag).map((q) => q.id)).toContain('S1-03-0001')
    expect(searchQuestions(QS, 'nvl').length).toBeGreaterThan(0) // SQL·본문 속 NVL
  })

  it('낱말이 여러 개면 모두 들어 있는 문제만', () => {
    const one = searchQuestions(QS, 'TRUNCATE')
    const both = searchQuestions(QS, 'TRUNCATE DROP')
    expect(both.length).toBeLessThanOrEqual(one.length)
    expect(searchQuestions(QS, 'TRUNCATE 없는낱말xyz')).toEqual([])
  })
})

describe('T7-1 문제 목록', () => {
  it(`많으면 ${PAGE_SIZE}개씩, 더 보기`, () => {
    const many = Array.from({ length: PAGE_SIZE + 5 }, (_, i) => ({ ...QS[0]!, id: `S1-05-${String(i + 1).padStart(4, '0')}` }))
    render(<BankQuestionList questions={many} />)
    const list = screen.getAllByRole('listitem').filter((li) => li.querySelector('[aria-expanded]'))
    expect(list).toHaveLength(PAGE_SIZE)
    fireEvent.click(screen.getByRole('button', { name: '더 보기 (5문제 남음)' }))
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(PAGE_SIZE + 5)
  })
})

describe('T7-1 문제 관리 화면', () => {
  afterEach(() => setStorage(undefined))

  async function open(user: UserQuestion[] = []) {
    const storage = createIndexedDbStorage(`bank-${Math.random()}`)
    for (const u of user) await storage.putUserQuestion(u)
    setStorage(storage)
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/bank']}>
          <AppRoutes />
        </MemoryRouter>
      </ThemeProvider>,
    )
    await screen.findByRole('heading', { name: /전체 문제|찾은 문제/ })
  }
  const resultCard = () => screen.getByRole('heading', { name: /전체 문제|찾은 문제/ }).closest('section')!
  const rowIds = () =>
    within(resultCard())
      .queryAllByRole('button', { expanded: false })
      .map((b) => b.textContent?.slice(0, 10))

  const userQ: UserQuestion = {
    ...byId('S1-05-0001'),
    id: 'U-S1-05-0001',
    source: 'user',
    topic: '내가 만든 GROUP BY 문제',
    createdAt: '2026-11-04T00:00:00Z',
    updatedAt: '2026-11-04T00:00:00Z',
  }

  it('전체 문제 수·과목별 수, 직접 추가 문제는 배지로 구분', async () => {
    await open([userQ])
    // 직접 추가 문제는 저장소에서 조금 늦게 들어온다
    expect(await screen.findByText(`전체 ${QS.length + 1}문제 — 1과목 4 · 2과목 ${QS.length - 4 + 1} (직접 추가 1)`)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: `전체 문제 ${QS.length + 1}개` })).toBeInTheDocument()
    expect(within(resultCard()).getAllByText('직접 추가')).toHaveLength(1)
  })

  it('검색·필터를 바꾸면 목록이 줄어든다', async () => {
    await open([userQ])
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'S1-05' } })
    expect(screen.getByRole('heading', { name: '찾은 문제 2개' })).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('group', { name: '출처' })).getByRole('button', { name: '직접 추가' }))
    expect(screen.getByRole('heading', { name: '찾은 문제 1개' })).toBeInTheDocument()
    expect(rowIds()).toEqual(['U-S1-05-00'])

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    fireEvent.click(within(screen.getByRole('group', { name: '출처' })).getByRole('button', { name: '직접 추가' }))
    fireEvent.click(within(screen.getByRole('group', { name: '과목' })).getByRole('button', { name: '1과목' }))
    expect(screen.getByRole('heading', { name: '찾은 문제 4개' })).toBeInTheDocument()
    // 1과목을 고르면 단원 목록도 1과목 단원만
    const options = within(screen.getByRole('combobox')).getAllByRole('option').map((o) => o.textContent)
    expect(options.every((o) => o === '전체 단원' || o?.startsWith('M'))).toBe(true)
  })

  it('단원 고르기, 조건에 맞는 문제가 없으면 안내', async () => {
    await open()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'S2-04' } })
    expect(rowIds()).toEqual(['S2-04-0001'])
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'M1-02' } })
    expect(screen.getByText('조건에 맞는 문제가 없습니다.')).toBeInTheDocument()
  })

  it('줄을 누르면 미리보기(문제·정답·해설·시험 포인트)', async () => {
    await open()
    const q = byId('S3-03-0001')
    const row = within(resultCard()).getByText(q.topic).closest('li')!
    fireEvent.click(within(row).getByRole('button'))
    expect(within(row).getByRole('article', { name: '문제' })).toBeInTheDocument()
    expect(within(row).getByText(`시험 포인트 · ${q.examPoint}`)).toBeInTheDocument()
    // 정답 보기에 "정답" 표시 (보기는 원래 순서)
    const choices = within(within(row).getByRole('list', { name: '보기' })).getAllByRole('button')
    expect(choices[q.answer - 1]).toHaveTextContent('정답')
  })
})
