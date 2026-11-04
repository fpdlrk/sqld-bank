import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import {
  buildWrongNote,
  emptyNote,
  groupWrongNote,
  isMasteredAfter,
  setBookmark,
  setMastered,
  setMemo,
  type Attempt,
  type Note,
  type WrongNoteInfo,
} from '../src/domain'
import { createIndexedDbStorage, setStorage, type StorageAdapter } from '../src/storage'
import { formatDay } from '../src/pages/WrongNote/wrongNoteData'

const attempt = (ref: string, correct: boolean, at: string): Attempt => ({
  id: `${ref}@${at}`,
  questionRef: ref,
  sessionId: 's',
  mode: 'practice',
  chosen: correct ? 1 : null,
  correct,
  elapsedSec: 10,
  at,
})
const note = (ref: string, over: Partial<Note> = {}): Note => ({
  questionRef: ref,
  bookmarked: false,
  memo: '',
  mastered: false,
  updatedAt: '2026-11-03T00:00:00Z',
  ...over,
})
const INFO: Record<string, WrongNoteInfo> = {
  A: { subject: 2, chapter: 'S1-05', topic: 'A주제', variant: false },
  B: { subject: 2, chapter: 'S1-05', topic: 'B주제', variant: false },
  C: { subject: 1, chapter: 'M1-01', topic: 'C주제', variant: false },
  D: { subject: 2, chapter: 'S1-03', topic: 'D주제', variant: false },
  'TP03#7': { subject: 2, chapter: 'S1-05', topic: '변형', variant: true },
}
const infoOf = (ref: string) => INFO[ref]

describe('T6-1 오답노트 계산', () => {
  const attempts = [
    attempt('A', false, '2026-11-01T00:00:00Z'),
    attempt('A', false, '2026-11-02T00:00:00Z'), // A: 2번 틀림 → 오답
    attempt('B', false, '2026-11-01T00:00:00Z'),
    attempt('B', true, '2026-11-03T00:00:00Z'), // B: 나중에 맞힘 → 남음, 한 단계 아래 (T6-3)
    attempt('C', false, '2026-11-03T00:00:00Z'), // C: 오답이지만 mastered → 빠짐
    attempt('D', true, '2026-11-03T00:00:00Z'), // D: 틀린 적 없지만 북마크 → 남음
    attempt('TP03#7', false, '2026-11-04T00:00:00Z'), // 변형 문제 오답
    attempt('X', false, '2026-11-04T00:00:00Z'), // 찾을 수 없는 문제 → 빠짐
  ]
  const notes = [note('C', { mastered: true }), note('D', { bookmarked: true, memo: '메모' })]

  it('틀린 적 있고 이제 안다로 처리하지 않은 문제, 또는 북마크 (T6-3 기준)', () => {
    const entries = buildWrongNote(attempts, notes, infoOf)
    expect(entries.map((e) => e.ref).sort()).toEqual(['A', 'B', 'D', 'TP03#7'])
    expect(entries.find((e) => e.ref === 'B')).toMatchObject({ streak: 1, lastCorrect: true, wrongCount: 1 })
  })

  it('틀린 횟수·푼 횟수·마지막 풀이일·북마크·메모', () => {
    const entries = buildWrongNote(attempts, notes, infoOf)
    expect(entries.find((e) => e.ref === 'A')).toMatchObject({ wrongCount: 2, tries: 2, lastAt: '2026-11-02T00:00:00Z', lastCorrect: false })
    expect(entries.find((e) => e.ref === 'D')).toMatchObject({ bookmarked: true, memo: '메모', lastCorrect: true, wrongCount: 0 })
  })

  it('기록 순서가 섞여 있어도 시각 순서로 연속 정답 수를 센다', () => {
    const shuffled = [
      attempt('B', true, '2026-11-03T00:00:00Z'),
      attempt('B', false, '2026-11-01T00:00:00Z'),
      attempt('B', true, '2026-11-02T00:00:00Z'),
    ]
    expect(buildWrongNote(shuffled, [], infoOf)[0]).toMatchObject({ streak: 2, lastAt: '2026-11-03T00:00:00Z' })
  })

  it('단원별 묶음: 단원표 순서, 묶음 안은 복습 차례(단계 낮은 순 → 오래전에 푼 순)', () => {
    const groups = groupWrongNote(buildWrongNote(attempts, notes, infoOf))
    expect(groups.map((g) => g.chapter)).toEqual(['S1-03', 'S1-05'])
    expect(groups[1]?.entries.map((e) => e.ref)).toEqual(['A', 'TP03#7', 'B'])
    expect(groups[1]?.label).toBe('S1-05 GROUP BY, HAVING절')
  })

  it('날짜 표시', () => {
    const now = new Date('2026-12-01T00:00:00')
    expect(formatDay('2026-11-03T10:00:00', now)).toBe('11월 3일')
    expect(formatDay('2025-11-03T10:00:00', now)).toBe('2025년 11월 3일')
  })
})

describe('T6-1 오답노트 화면', () => {
  afterEach(() => setStorage(undefined))
  let n = 0
  async function renderWith(attempts: Attempt[], notes: Note[] = []) {
    const storage = createIndexedDbStorage(`wrong-${++n}`)
    for (const a of attempts) await storage.addAttempt(a)
    for (const x of notes) await storage.putNote(x)
    setStorage(storage)
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/wrong']}>
          <AppRoutes />
        </MemoryRouter>
      </ThemeProvider>,
    )
  }

  it('틀린 문제가 없으면 안내', async () => {
    await renderWith([])
    expect(await screen.findByText('오답노트가 비어 있습니다.')).toBeInTheDocument()
  })

  it('단원별 묶음과 횟수·날짜, 변형 문제 표시, 북마크 거르기', async () => {
    await renderWith(
      [
        attempt('S1-05-0001', false, '2026-11-01T01:00:00Z'),
        attempt('S1-05-0001', false, '2026-11-02T01:00:00Z'),
        attempt('M1-01-0001', false, '2026-11-02T01:00:00Z'),
        attempt('TP03#7', false, '2026-11-03T01:00:00Z'),
        attempt('S1-03-0001', true, '2026-11-03T01:00:00Z'),
      ],
      [note('S1-03-0001', { bookmarked: true })],
    )
    expect(await screen.findByText(/오답/, { selector: 'p' })).toHaveTextContent('오답 3문제 · 북마크 1문제')

    const s105 = screen.getByRole('heading', { name: 'S1-05 GROUP BY, HAVING절 (2)' }).closest('section')!
    expect(s105).toHaveTextContent('틀림 2회 / 풀이 2회 · 마지막 풀이 11월 2일')
    expect(within(s105).getByText('변형 문제')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'M1-01 데이터 모델의 이해 (1)' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: '★ 북마크' }))
    expect(screen.queryByRole('heading', { name: /S1-05/ })).toBeNull()
    const s103 = screen.getByRole('heading', { name: /^S1-03/ }).closest('section')!
    // 틀린 적 없는 북마크 문제: 단계 표시도 이제 안다 버튼도 없다
    expect(within(s103).getByText('★ 북마크')).toBeInTheDocument()
    expect(within(s103).queryByRole('button', { name: '이제 안다' })).toBeNull()
  })
})

// ───────────── T6-2 메모·북마크·이제 안다 ─────────────

describe('T6-2 상태 바꾸기 함수', () => {
  const t1 = new Date('2026-11-03T10:00:00Z')
  const t2 = new Date('2026-11-03T11:00:00Z')

  it('북마크·메모는 updatedAt만 바꾼다', () => {
    const n = setMemo(setBookmark(emptyNote('A', t1), true, t1), '외울 것', t2)
    expect(n).toMatchObject({ bookmarked: true, memo: '외울 것', mastered: false, updatedAt: t2.toISOString() })
    expect(n.masteredAt).toBeUndefined()
  })

  it('"이제 안다"는 누른 시각을 남기고, 끄면 지운다', () => {
    const on = setMastered(emptyNote('A', t1), true, t1)
    expect(on).toMatchObject({ mastered: true, masteredAt: t1.toISOString() })
    expect('masteredAt' in setMastered(on, false, t2)).toBe(false)
  })

  it('"이제 안다" 뒤에 다시 틀리면 오답노트에 다시 나온다 (메모를 나중에 고쳐도)', () => {
    const mastered = setMemo(setMastered(emptyNote('A'), true, t1), '메모', t2) // 이제 안다 → 그 뒤 메모 수정
    expect(isMasteredAfter(mastered, '2026-11-03T09:00:00.000Z')).toBe(true) // 이전 오답 → 숨김
    expect(isMasteredAfter(mastered, '2026-11-03T10:30:00.000Z')).toBe(false) // 이제 안다 뒤 오답 → 다시 표시
    const entries = buildWrongNote([attempt('A', false, '2026-11-03T10:30:00.000Z')], [mastered], infoOf)
    expect(entries.map((e) => e.ref)).toEqual(['A'])
  })
})

describe('T6-2 오답노트 화면에서 메모·북마크·이제 안다', () => {
  afterEach(() => setStorage(undefined))
  let n = 0
  let storage: StorageAdapter
  const REF = 'S1-05-0001'
  async function open() {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/wrong']}>
          <AppRoutes />
        </MemoryRouter>
      </ThemeProvider>,
    )
    return (await screen.findByRole('heading', { name: /^S1-05/ })).closest('section')!
  }
  async function setup() {
    storage = createIndexedDbStorage(`wrong62-${++n}`)
    await storage.addAttempt(attempt(REF, false, '2026-11-02T01:00:00Z'))
    setStorage(storage)
    return open()
  }

  it('북마크 켜기·끄기가 저장되고 표시가 바뀐다', async () => {
    const card = await setup()
    fireEvent.click(within(card).getByRole('button', { name: '☆ 북마크' }))
    expect(await within(card).findByText('★ 북마크')).toBeInTheDocument()
    expect((await storage.getNote(REF))?.bookmarked).toBe(true)
    fireEvent.click(within(card).getByRole('button', { name: '★ 북마크 해제' }))
    await waitFor(async () => expect((await storage.getNote(REF))?.bookmarked).toBe(false))
  })

  it('자세히: 문제·정답·해설이 펼쳐지고, 메모는 입력을 멈추면 자동 저장된다', async () => {
    const card = await setup()
    fireEvent.click(within(card).getByRole('button', { name: '자세히 ▼' }))
    expect(await within(card).findByRole('article', { name: '문제' })).toBeInTheDocument()
    expect(within(card).getByText(/시험 포인트/)).toBeInTheDocument()

    fireEvent.change(within(card).getByLabelText(/메모/), { target: { value: 'WHERE는 집계 전!' } })
    expect(await within(card).findByText('저장됨', {}, { timeout: 3000 })).toBeInTheDocument()
    expect((await storage.getNote(REF))?.memo).toBe('WHERE는 집계 전!')

    // 다시 열면 메모가 그대로, 접힌 줄에는 메모 미리보기
    cleanup()
    const again = await open()
    expect(again).toHaveTextContent('메모: WHERE는 집계 전!')
  })

  it('이제 안다 → 목록에서 빠지고 저장, 되돌리기로 복구', async () => {
    const card = await setup()
    fireEvent.click(within(card).getByRole('button', { name: '이제 안다' }))
    expect(await screen.findByText(/오답노트에서 뺐습니다/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^S1-05/ })).toBeNull()
    expect((await storage.getNote(REF))?.mastered).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
    expect(await screen.findByRole('heading', { name: /^S1-05/ })).toBeInTheDocument()
    await waitFor(async () => expect((await storage.getNote(REF))?.mastered).toBe(false))
  })

  it('이제 안다로 뺀 문제는 다시 열어도 안 나온다', async () => {
    await setup()
    await storage.putNote(setMastered(emptyNote(REF), true))
    cleanup()
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/wrong']}>
          <AppRoutes />
        </MemoryRouter>
      </ThemeProvider>,
    )
    expect(await screen.findByText('오답노트가 비어 있습니다.')).toBeInTheDocument()
  })
})
