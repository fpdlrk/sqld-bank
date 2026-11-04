import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import {
  buildWrongNote,
  correctStreaks,
  emptyNote,
  reviewQueue,
  setMastered,
  stageLabel,
  type Attempt,
  type Question,
  type WrongNoteInfo,
} from '../src/domain'
import { createIndexedDbStorage, setStorage, type StorageAdapter } from '../src/storage'

const attempt = (ref: string, correct: boolean, at: string): Attempt => ({
  id: `${ref}@${at}`,
  questionRef: ref,
  sessionId: 'old',
  mode: 'practice',
  chosen: correct ? 1 : 2,
  correct,
  elapsedSec: 10,
  at,
})
const info: WrongNoteInfo = { subject: 2, chapter: 'S1-05', topic: 't', variant: false }

describe('T6-3 단계(연속 정답)와 복습 차례', () => {
  it('연속 정답 수: 틀리면 0으로', () => {
    const s = correctStreaks([
      attempt('A', false, '2026-11-01T00:00:00Z'),
      attempt('A', true, '2026-11-02T00:00:00Z'),
      attempt('A', true, '2026-11-03T00:00:00Z'),
      attempt('B', true, '2026-11-01T00:00:00Z'),
      attempt('B', false, '2026-11-02T00:00:00Z'),
    ])
    expect(s.get('A')).toBe(2)
    expect(s.get('B')).toBe(0)
  })

  it('단계 이름', () => {
    expect([0, 1, 2, 3].map(stageLabel)).toEqual(['복습 필요', '1회 정답', '2회 연속 정답', '3회 연속 정답'])
  })

  it('"이제 안다" 뒤에 맞히면 계속 빠져 있고, 틀리면 다시 나온다', () => {
    const mastered = setMastered(emptyNote('A'), true, new Date('2026-11-02T00:00:00Z'))
    const base = [attempt('A', false, '2026-11-01T00:00:00Z')]
    expect(buildWrongNote([...base, attempt('A', true, '2026-11-03T00:00:00Z')], [mastered], () => info)).toEqual([])
    expect(buildWrongNote([...base, attempt('A', false, '2026-11-03T00:00:00Z')], [mastered], () => info)).toHaveLength(1)
  })

  it('복습 차례: 단계 낮은 순 → 오래전에 푼 순, 이제 안다·북마크만 한 문제 제외, 최대 개수', () => {
    const entries = buildWrongNote(
      [
        attempt('S1', false, '2026-11-01T00:00:00Z'),
        attempt('S1', true, '2026-11-02T00:00:00Z'), // 단계 1
        attempt('Z1', false, '2026-11-03T00:00:00Z'), // 단계 0, 최근
        attempt('Z2', false, '2026-11-02T00:00:00Z'), // 단계 0, 오래됨
        attempt('M', false, '2026-11-01T00:00:00Z'), // 이제 안다
        attempt('BK', true, '2026-11-01T00:00:00Z'), // 북마크만
      ],
      [setMastered(emptyNote('M'), true, new Date('2026-11-05T00:00:00Z')), { ...emptyNote('BK'), bookmarked: true }],
      () => info,
    )
    expect(reviewQueue(entries).map((e) => e.ref)).toEqual(['Z2', 'Z1', 'S1'])
    expect(reviewQueue(entries, 2).map((e) => e.ref)).toEqual(['Z2', 'Z1'])
  })
})

// ───────────── 화면 ─────────────

const Q = (id: string) => BUILT_IN_QUESTIONS.find((q) => q.id === id) as Question
const A = Q('S1-05-0001') // 이미 1번 맞힘 → 이번에 맞히면 2회 연속
const B = Q('S1-04-0001') // 틀리기만 함
const C = Q('M1-01-0001') // 다른 단원

let n = 0
let storage: StorageAdapter
async function setup() {
  storage = createIndexedDbStorage(`review-${++n}`)
  for (const a of [
    attempt(A.id, false, '2026-11-01T00:00:00Z'),
    attempt(A.id, true, '2026-11-02T00:00:00Z'),
    attempt(B.id, false, '2026-11-01T00:00:00Z'),
    attempt(C.id, false, '2026-11-03T00:00:00Z'),
  ])
    await storage.addAttempt(a)
  setStorage(storage)
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/wrong']}>
        <AppRoutes />
      </MemoryRouter>
    </ThemeProvider>,
  )
  await screen.findByRole('heading', { name: '오답노트' })
}
afterEach(() => setStorage(undefined))

/** 보기 순서가 섞여 있어도 정답 글자로 보기 버튼을 찾는다 */
const answerButton = (q: Question) =>
  within(screen.getByRole('list', { name: '보기' }))
    .getAllByRole('button')
    .find((b) => b.textContent?.includes(q.choices[q.answer - 1] ?? '\u0000'))!
const currentQuestion = () => [A, B, C].find((q) => screen.queryByText(q.stem.slice(0, 15), { exact: false }))!

describe('T6-3 복습 모드 화면', () => {
  it('오답노트에 단계 표시, 복습 시작 → 오답 복습 화면 (단계 낮은 문제부터)', async () => {
    await setup()
    const s105 = (await screen.findByRole('heading', { name: /^S1-05/ })).closest('section')!
    expect(within(s105).getByText('1회 정답')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '복습 시작 (3문제)' }))

    expect(await screen.findByRole('heading', { name: '오답 복습' })).toBeInTheDocument()
    const [review] = await storage.listSessions({ mode: 'review' })
    expect(review?.questionRefs).toEqual([B.id, C.id, A.id]) // 단계 0(오래된 순) → 단계 1
  })

  it('2회 연속 맞히면 "이제 안다" 제안 → 처리하면 저장, 1회째는 제안하지 않음', async () => {
    await setup()
    fireEvent.click(await screen.findByRole('button', { name: '복습 시작 (3문제)' }))
    await screen.findByRole('heading', { name: '오답 복습' })

    // 1번(B): 맞혀도 첫 정답이라 제안 없음
    expect(currentQuestion()).toBe(B)
    fireEvent.click(answerButton(B))
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(screen.queryByText(/연속 맞혔습니다/)).toBeNull()

    // 3번(A)으로 이동해 맞히면 2회 연속 → 제안
    fireEvent.click(screen.getByRole('button', { name: '다음 문제' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 ▶' }))
    expect(currentQuestion()).toBe(A)
    fireEvent.click(answerButton(A))
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(screen.getByText(/2회 연속 맞혔습니다/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '이제 안다' }))
    expect(await screen.findByText(/이제 안다로 처리했습니다/)).toBeInTheDocument()
    expect((await storage.getNote(A.id))?.mastered).toBe(true)

    // 기록은 review 모드로 저장
    await waitFor(async () => expect((await storage.listAttempts()).filter((a) => a.mode === 'review')).toHaveLength(2))
  })

  it('이 단원 복습 → 그 단원 문제만, 그만두기 → 오답노트', async () => {
    await setup()
    const m101 = (await screen.findByRole('heading', { name: /^M1-01/ })).closest('section')!
    fireEvent.click(within(m101).getByRole('button', { name: '이 단원 복습' }))
    expect(await screen.findByText('문제 1 / 1')).toBeInTheDocument()
    const [review] = await storage.listSessions({ mode: 'review' })
    expect(review?.questionRefs).toEqual([C.id])
    fireEvent.click(screen.getByRole('button', { name: '그만두기' }))
    expect(await screen.findByRole('heading', { name: '오답노트' })).toBeInTheDocument()
  })

  it('복습에서 맞힌 문제는 오답노트에서 한 단계 내려간다', async () => {
    await setup()
    fireEvent.click(await screen.findByRole('button', { name: '복습 시작 (3문제)' }))
    await screen.findByRole('heading', { name: '오답 복습' })
    fireEvent.click(answerButton(B))
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    await waitFor(async () => expect((await storage.listAttempts({ questionRef: B.id })).length).toBe(2))

    cleanup()
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/wrong']}>
          <AppRoutes />
        </MemoryRouter>
      </ThemeProvider>,
    )
    const s104 = (await screen.findByRole('heading', { name: /^S1-04/ })).closest('section')!
    expect(within(s104).getByText('1회 정답')).toBeInTheDocument()
  })
})
