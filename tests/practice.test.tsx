import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import {
  DEFAULT_PRACTICE_SETTINGS,
  PRACTICE_SETTINGS_KEY,
  normalizePracticeSettings,
  pickPracticeQuestions,
  practiceCandidates,
  shuffled,
  summarizeAttempts,
  withSubjects,
  type Attempt,
  type PracticeSettings,
} from '../src/domain'
import { createIndexedDbStorage, setStorage } from '../src/storage'
import { PracticeSetup } from '../src/pages/Practice/PracticeSetup'
import { PracticePage } from '../src/pages/Practice/PracticePage'

const questions = [...BUILT_IN_QUESTIONS]
const settings = (over: Partial<PracticeSettings> = {}): PracticeSettings => ({ ...DEFAULT_PRACTICE_SETTINGS, ...over })
const attempt = (questionRef: string, correct: boolean, at: string): Attempt => ({
  id: `${questionRef}-${at}`,
  questionRef,
  sessionId: 's',
  mode: 'practice',
  chosen: 1,
  correct,
  elapsedSec: 10,
  at,
})

/** 항상 같은 순서를 내는 가짜 난수 (테스트용) */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

describe('T3-3 설정 정리', () => {
  it('저장된 값이 없거나 깨졌으면 기본값', () => {
    expect(normalizePracticeSettings(undefined)).toEqual(DEFAULT_PRACTICE_SETTINGS)
    expect(normalizePracticeSettings('이상한 값')).toEqual(DEFAULT_PRACTICE_SETTINGS)
  })

  it('없는 단원·유형·중복은 버리고, 빠진 항목은 기본값으로 채운다', () => {
    const s = normalizePracticeSettings({ chapters: ['S1-05', 'X9-99', 'S1-05'], types: ['concept', 'essay'], count: 15 })
    expect(s.chapters).toEqual(['S1-05'])
    expect(s.types).toEqual(['concept'])
    expect(s.count).toBe(10)
    expect(s.shuffle).toBe(true)
  })

  it('과목을 고르면 다른 과목 단원 선택은 지워진다', () => {
    const s = withSubjects(settings({ chapters: ['M1-01', 'S1-05'] }), [2])
    expect(s.chapters).toEqual(['S1-05'])
    expect(withSubjects(settings({ chapters: ['M1-01'] }), []).chapters).toEqual(['M1-01'])
  })
})

describe('T3-3 풀이 요약', () => {
  it('문제별 푼 횟수와 "가장 최근" 정답 여부', () => {
    const stats = summarizeAttempts([
      attempt('A', false, '2026-11-02T00:00:00Z'),
      attempt('A', true, '2026-11-03T00:00:00Z'),
      attempt('B', true, '2026-11-03T00:00:00Z'),
      attempt('B', false, '2026-11-01T00:00:00Z'), // 순서가 섞여 들어와도 시각으로 판단
    ])
    expect(stats.get('A')).toMatchObject({ tries: 2, lastCorrect: true })
    expect(stats.get('B')).toMatchObject({ tries: 2, lastCorrect: true })
  })
})

describe('T3-3 출제', () => {
  const stats = summarizeAttempts([
    attempt('S1-05-0001', false, '2026-11-03T00:00:00Z'),
    attempt('S1-04-0001', true, '2026-11-03T00:00:00Z'),
  ])

  it('과목·유형·난이도 조건', () => {
    expect(practiceCandidates(questions, settings({ subjects: [1] }), stats).every((q) => q.subject === 1)).toBe(true)
    const ids = practiceCandidates(questions, settings({ types: ['sql_result'], difficulties: [3] }), stats).map((q) => q.id)
    expect(ids).toEqual(['S1-08-0001'])
  })

  it('안 푼 문제만 / 틀린 문제만', () => {
    const unsolved = practiceCandidates(questions, settings({ progress: 'unsolved' }), stats).map((q) => q.id)
    expect(unsolved).not.toContain('S1-05-0001')
    expect(unsolved).not.toContain('S1-04-0001')
    expect(unsolved).toHaveLength(questions.length - 2)
    expect(practiceCandidates(questions, settings({ progress: 'wrong' }), stats).map((q) => q.id)).toEqual(['S1-05-0001'])
  })

  it('섞기는 항목을 잃지 않고, 같은 난수면 같은 순서', () => {
    const a = shuffled([1, 2, 3, 4, 5, 6], seeded(7))
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6])
    expect(shuffled([1, 2, 3, 4, 5, 6], seeded(7))).toEqual(a)
  })

  it('문항 수만큼 자르고, 섞지 않으면 ID 순', () => {
    const picked = pickPracticeQuestions(questions, settings({ count: 10, shuffle: false }), stats)
    expect(picked).toHaveLength(10)
    expect(picked.map((q) => q.id)).toEqual(questions.slice(0, 10).map((q) => q.id))
    expect(pickPracticeQuestions(questions, settings({ count: 'all' }), stats, seeded(1))).toHaveLength(questions.length)
  })
})

describe('T3-3 설정 화면', () => {
  const summary = () => screen.getByText(/조건에 맞는|조건에 맞는 문제가 없습니다/)

  it('조건을 바꾸면 출제 가능 문항 수가 바로 바뀐다', () => {
    render(<PracticeSetup questions={questions} stats={new Map()} initialSettings={settings()} onStart={vi.fn()} />)
    expect(summary()).toHaveTextContent(`조건에 맞는 문제 ${questions.length}개 → 이번에 10문제`)

    fireEvent.click(within(screen.getByRole('group', { name: '과목' })).getByRole('button', { name: /1과목/ }))
    expect(summary()).toHaveTextContent('조건에 맞는 문제 4개 → 이번에 4문제')
    // 1과목만 고르면 2과목 단원 묶음은 보이지 않는다
    expect(screen.queryByText(/2과목 A/)).toBeNull()
  })

  it('단원 체크 → 단원 수 반영, 문제 수 표시', () => {
    render(<PracticeSetup questions={questions} stats={new Map()} initialSettings={settings()} onStart={vi.fn()} />)
    const row = screen.getByText('S1-05 GROUP BY, HAVING절').closest('label')!
    expect(row).toHaveTextContent('1문제')
    fireEvent.click(within(row).getByRole('checkbox'))
    expect(summary()).toHaveTextContent('조건에 맞는 문제 1개 → 이번에 1문제')
    fireEvent.click(screen.getByRole('button', { name: /선택 해제/ }))
    expect(summary()).toHaveTextContent(`${questions.length}개`)
  })

  it('조건에 맞는 문제가 없으면 시작할 수 없다', () => {
    render(
      <PracticeSetup questions={questions} stats={new Map()} initialSettings={settings({ progress: 'wrong' })} onStart={vi.fn()} />,
    )
    expect(summary()).toHaveTextContent('조건에 맞는 문제가 없습니다')
    expect(screen.getByRole('button', { name: '연습 시작' })).toBeDisabled()
  })

  it('하나만 고르는 항목(풀이 상태·문항 수)과 시작', () => {
    const onStart = vi.fn()
    render(<PracticeSetup questions={questions} stats={new Map()} initialSettings={settings()} onStart={onStart} />)
    const count = screen.getByRole('radiogroup', { name: '문항 수' })
    fireEvent.click(within(count).getByRole('radio', { name: '전체' }))
    expect(within(count).getByRole('radio', { name: '전체' })).toHaveAttribute('aria-checked', 'true')
    expect(within(count).getByRole('radio', { name: '10문제' })).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('checkbox', { name: '문제 순서 섞기' }))
    fireEvent.click(screen.getByRole('button', { name: '연습 시작' }))
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ count: 'all', shuffle: false }))
  })
})

describe('T3-3 연습 화면 (저장소 연결)', () => {
  afterEach(() => setStorage(undefined))

  it('마지막 설정을 불러오고, 시작하면 설정을 저장하고 그 조건으로 연습 회차를 만든다', async () => {
    const storage = createIndexedDbStorage('practice-page')
    await storage.setMeta(PRACTICE_SETTINGS_KEY, settings({ subjects: [1], shuffle: false }))
    setStorage(storage)

    render(
      <MemoryRouter initialEntries={['/practice']}>
        <Routes>
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/practice/:sessionId" element={<p>풀이 화면</p>} />
        </Routes>
      </MemoryRouter>,
    )
    const subject1 = await screen.findByRole('button', { name: /1과목/ })
    expect(subject1).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(within(screen.getByRole('radiogroup', { name: '문항 수' })).getByRole('radio', { name: '20문제' }))
    fireEvent.click(screen.getByRole('button', { name: '연습 시작' }))

    expect(await screen.findByText('풀이 화면')).toBeInTheDocument()
    const [session] = await storage.listSessions()
    expect(session?.questionRefs).toEqual(['M1-01-0001', 'M1-04-0001', 'M1-05-0001', 'M2-01-0001'])
    expect(await storage.getMeta(PRACTICE_SETTINGS_KEY)).toMatchObject({ subjects: [1], count: 20 })
  })
})
