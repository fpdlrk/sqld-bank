import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import { TrendChart } from '../src/components'
import {
  EXAM_DATE_KEY,
  PRACTICE_SETTINGS_KEY,
  createExamSession,
  createPracticeSession,
  daysUntil,
  formatDDay,
  isValidDateString,
  type Attempt,
  type Session,
} from '../src/domain'
import { createIndexedDbStorage, setStorage, type StorageAdapter } from '../src/storage'

describe('T6-5 D-day', () => {
  it('현지 날짜 기준으로 남은 날 수 (시각은 무시)', () => {
    expect(daysUntil('2026-11-27', new Date(2026, 10, 4, 23, 59))).toBe(23)
    expect(daysUntil('2026-11-27', new Date(2026, 10, 27, 0, 1))).toBe(0)
    expect(daysUntil('2026-11-27', new Date(2026, 10, 30, 9, 0))).toBe(-3)
  })

  it('표시와 날짜 검사', () => {
    expect([23, 0, -3].map(formatDDay)).toEqual(['D-23', 'D-Day', 'D+3'])
    expect(isValidDateString('2026-11-27')).toBe(true)
    expect(isValidDateString('2026-02-30')).toBe(false)
    expect(isValidDateString('11/27')).toBe(false)
    expect(isValidDateString(20261127)).toBe(false)
  })
})

describe('T6-5 점수 추이 그래프 (SVG)', () => {
  const points = [
    { label: '11/1', value: 48, detail: '48/100점 · 불합격' },
    { label: '11/8', value: 62, detail: '62/100점 · 합격' },
    { label: '11/15', value: 74, detail: '74/100점 · 합격' },
  ]

  it('점 개수·요약·합격선·선', () => {
    const { container } = render(<TrendChart points={points} summary="모의고사 3회, 최근 74%" threshold={{ value: 60, label: '합격선 60%' }} />)
    expect(screen.getByRole('img', { name: '모의고사 3회, 최근 74%' })).toBeInTheDocument()
    expect(screen.getAllByTestId('trend-dot')).toHaveLength(3)
    expect(screen.getByText('합격선 60%')).toBeInTheDocument()
    expect(container.querySelector('path')).not.toBeNull()
  })

  it('키보드로 회차를 옮기며 툴팁을 본다 (포커스 → 최근 회차, ← 이전)', () => {
    render(<TrendChart points={points} summary="s" />)
    const svg = screen.getByRole('img')
    fireEvent.focus(svg)
    expect(screen.getByRole('status')).toHaveTextContent('11/15 74%74/100점 · 합격')
    fireEvent.keyDown(svg, { key: 'ArrowLeft' })
    expect(screen.getByRole('status')).toHaveTextContent('11/8 62%')
    fireEvent.keyDown(svg, { key: 'Escape' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('표로 보기: 같은 값을 표로', () => {
    render(<TrendChart points={points} summary="s" />)
    const rows = within(screen.getByRole('table', { hidden: true })).getAllByRole('row', { hidden: true })
    expect(rows).toHaveLength(4)
    expect(rows[1]).toHaveTextContent('11/148%48/100점 · 불합격')
  })

  it('한 회만 있으면 선 없이 점 하나', () => {
    const { container } = render(<TrendChart points={points.slice(0, 1)} summary="s" />)
    expect(screen.getAllByTestId('trend-dot')).toHaveLength(1)
    expect(container.querySelector('path')).toBeNull()
  })
})

// ───────────── 대시보드 화면 ─────────────

let n = 0
let storage: StorageAdapter
async function open(prepare?: (s: StorageAdapter) => Promise<void>) {
  storage = createIndexedDbStorage(`dash-${++n}`)
  await prepare?.(storage)
  setStorage(storage)
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    </ThemeProvider>,
  )
  await screen.findByRole('heading', { name: '시험 D-day' })
}
afterEach(() => setStorage(undefined))

const card = (name: string | RegExp) => screen.getByRole('heading', { name }).closest('section')!
let k = 0
const attempt = (ref: string, correct: boolean): Attempt => ({
  id: `a${++k}`,
  questionRef: ref,
  sessionId: 's',
  mode: 'practice',
  chosen: 1,
  correct,
  elapsedSec: 5,
  at: new Date().toISOString(),
})

describe('T6-5 대시보드', () => {
  it('기록이 없을 때: 시험일 입력, 안내 문구들', async () => {
    await open()
    expect(within(card('시험 D-day')).getByLabelText('시험일')).toBeInTheDocument()
    expect(card('이어 풀기')).toHaveTextContent('진행 중인 연습이나 시험이 없습니다.')
    expect(card(/과목별 정답률/)).toHaveTextContent('1과목: 아직 푼 기록이 없습니다.')
    expect(card('모의고사 점수 추이')).toHaveTextContent('아직 제출한 모의고사가 없습니다.')
  })

  it('시험일을 저장하면 D-day가 보이고 저장소에 남는다', async () => {
    await open()
    const target = new Date()
    target.setDate(target.getDate() + 10)
    const iso = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
    fireEvent.change(within(card('시험 D-day')).getByLabelText('시험일'), { target: { value: iso } })
    fireEvent.click(within(card('시험 D-day')).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('D-10')).toBeInTheDocument()
    expect(await storage.getMeta(EXAM_DATE_KEY)).toBe(iso)
  })

  it('과목별 정답률 막대, 취약 단원 → 연습하기 누르면 그 단원으로 연습 설정', async () => {
    await open(async (s) => {
      for (const a of [
        ...Array.from({ length: 4 }, () => attempt('S1-05-0001', false)),
        attempt('S1-05-0001', true), // S1-05: 1/5 = 20%
        attempt('M1-01-0001', true),
      ])
        await s.addAttempt(a)
    })
    expect(within(card(/과목별 정답률/)).getByRole('progressbar', { name: '2과목 정답률 20%' })).toBeInTheDocument()
    expect(within(card(/과목별 정답률/)).getByRole('progressbar', { name: '1과목 정답률 100%' })).toBeInTheDocument()

    const weak = card('취약 단원')
    expect(weak).toHaveTextContent('S1-05 GROUP BY, HAVING절 · 정답률 20% (1/5)')
    fireEvent.click(within(weak).getByRole('button', { name: '연습하기' }))
    expect(await screen.findByRole('heading', { name: '단원별 연습' })).toBeInTheDocument()
    expect(await storage.getMeta(PRACTICE_SETTINGS_KEY)).toMatchObject({ chapters: ['S1-05'], subjects: [] })
    const row = (await screen.findByText('S1-05 GROUP BY, HAVING절')).closest('label')!
    expect(within(row).getByRole('checkbox')).toBeChecked()
  })

  it('이어 풀기: 끝내지 않은 연습·모의고사 링크 (모의고사는 남은 시간)', async () => {
    let practice!: Session
    let exam!: Session
    await open(async (s) => {
      practice = createPracticeSession(BUILT_IN_QUESTIONS.slice(0, 3))
      exam = createExamSession(BUILT_IN_QUESTIONS.slice(0, 5))
      await s.putSession(practice)
      await s.putSession(exam)
    })
    const c = card('이어 풀기')
    expect(within(c).getByRole('link', { name: /단원별 연습/ })).toHaveAttribute('href', `/practice/${practice.id}`)
    const examLink = within(c).getByRole('link', { name: /모의고사/ })
    expect(examLink).toHaveAttribute('href', `/exam/${exam.id}`)
    expect(examLink).toHaveTextContent(/남은 시간 (90:00|89:5\d)/)
  })

  it('모의고사 점수 추이: 제출한 시험마다 점 하나', async () => {
    await open(async (s) => {
      for (const [day, s1, s2] of [
        [1, 10, 40],
        [2, 14, 50],
      ] as const) {
        const base = createExamSession(BUILT_IN_QUESTIONS, { now: new Date(2026, 10, day) })
        await s.putSession({ ...base, finishedAt: new Date(2026, 10, day, 1).toISOString(), subjectScores: { 1: s1, 2: s2 }, passed: false })
      }
    })
    await waitFor(() => expect(screen.getAllByTestId('trend-dot')).toHaveLength(2))
    expect(screen.getByRole('img', { name: /모의고사 2회/ })).toBeInTheDocument()
  })
})
