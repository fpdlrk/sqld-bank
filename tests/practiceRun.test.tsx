import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import {
  PRACTICE_SETTINGS_KEY,
  DEFAULT_PRACTICE_SETTINGS,
  createPracticeSession,
  finishSession,
  moveTo,
  recordAnswer,
  summarizeSession,
  type ChoiceNumber,
  type Question,
} from '../src/domain'
import { createIndexedDbStorage, setStorage, type StorageAdapter } from '../src/storage'
import { indexByRef } from '../src/pages/Practice/loadQuestions'

const byId = (id: string) => BUILT_IN_QUESTIONS.find((q) => q.id === id) as Question
const wrongOf = (q: Question) => ((q.answer % 4) + 1) as ChoiceNumber
const SUBJECT1 = ['M1-01-0001', 'M1-04-0001', 'M1-05-0001', 'M2-01-0001'].map(byId)
const allByRef = indexByRef(BUILT_IN_QUESTIONS)
// 화면 흐름 테스트는 보기를 원래 번호 위치로 누르므로 보기 섞기를 끈다 (섞기는 choiceOrder.test.tsx)
const NO_SHUFFLE = { shuffleChoices: false }

describe('T3-4 회차 함수', () => {
  it('새 회차는 진행 중, 첫 문항, 답 없음', () => {
    const s = createPracticeSession(SUBJECT1, { now: new Date('2026-11-03T10:00:00Z'), shuffleChoices: false })
    expect(s).toMatchObject({ mode: 'practice', finishedAt: null, startedAt: '2026-11-03T10:00:00.000Z' })
    expect(s.questionRefs).toEqual(SUBJECT1.map((q) => q.id))
    expect(s.progress).toEqual({ currentIndex: 0, answers: {}, flagged: [], choiceOrders: {} })
  })

  it('이동은 범위 안으로, 답 기록은 원본을 바꾸지 않는다', () => {
    const s = createPracticeSession(SUBJECT1, NO_SHUFFLE)
    expect(moveTo(s, 99).progress?.currentIndex).toBe(3)
    expect(moveTo(s, -1).progress?.currentIndex).toBe(0)
    const s2 = recordAnswer(s, 'M1-01-0001', 2)
    expect(s2.progress?.answers).toEqual({ 'M1-01-0001': 2 })
    expect(s.progress?.answers).toEqual({})
  })

  it('요약: 정답 수·정답률(푼 문제 기준)·단원별·틀린 문제, 없는 문제는 건너뜀', () => {
    const [a, b, c] = SUBJECT1 as [Question, Question, Question]
    let s = createPracticeSession([...SUBJECT1], NO_SHUFFLE)
    s = { ...s, questionRefs: [...s.questionRefs, '지워진-문제'] }
    s = recordAnswer(s, a.id, a.answer)
    s = recordAnswer(s, b.id, wrongOf(b))
    s = recordAnswer(s, c.id, c.answer)
    const sum = summarizeSession(s, allByRef)
    expect(sum).toMatchObject({ total: 4, answered: 3, correct: 2, rate: 67, wrongRefs: [b.id] })
    expect(sum.byChapter.map((r) => [r.chapter, r.answered, r.correct])).toEqual([
      ['M1-01', 1, 1],
      ['M1-04', 1, 0],
      ['M1-05', 1, 1],
      ['M2-01', 0, 0],
    ])
    const done = finishSession(s, allByRef, new Date('2026-11-03T11:00:00Z'))
    expect(done).toMatchObject({ finishedAt: '2026-11-03T11:00:00.000Z', score: 2 })
  })
})

// ───────────── 화면 흐름 ─────────────

let dbCount = 0
let storage: StorageAdapter

async function freshStorage() {
  storage = createIndexedDbStorage(`practice-run-${++dbCount}`)
  // 1과목 4문제, 섞지 않음 → 출제 순서가 고정된다
  await storage.setMeta(PRACTICE_SETTINGS_KEY, { ...DEFAULT_PRACTICE_SETTINGS, subjects: [1], shuffle: false, shuffleChoices: false })
  setStorage(storage)
}

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

const choice = (n: ChoiceNumber) => within(screen.getByRole('list', { name: '보기' })).getAllByRole('button')[n - 1]!
const progressLabel = () => screen.getByText(/^문제 \d+ \/ \d+$/)

async function answer(q: Question, chosen: ChoiceNumber) {
  fireEvent.click(choice(chosen))
  fireEvent.click(screen.getByRole('button', { name: '제출' }))
  // 회차·풀이 기록이 저장될 때까지 기다린다
  await waitFor(async () => {
    const [s] = await storage.listSessions()
    expect(s?.progress?.answers[q.id]).toBe(chosen)
  })
}

afterEach(() => setStorage(undefined))

describe('T3-4 연습 진행', () => {
  it('시작 → 풀기 → 다음 → 새로고침해도 같은 자리 → 끝내기 → 요약', async () => {
    await freshStorage()
    const [q1, q2] = SUBJECT1 as [Question, Question]
    renderAt('/practice')
    fireEvent.click(await screen.findByRole('button', { name: '연습 시작' }))

    expect(await screen.findByText('문제 1 / 4')).toBeInTheDocument()
    await answer(q1, q1.answer)
    expect(screen.getByRole('status')).toHaveTextContent('정답입니다')
    fireEvent.click(screen.getByRole('button', { name: '다음 문제' }))
    expect(progressLabel()).toHaveTextContent('문제 2 / 4')
    await answer(q2, wrongOf(q2))

    // ── 새로고침 흉내: 화면을 완전히 지우고 같은 주소로 다시 연다
    const [saved] = await storage.listSessions()
    cleanup()
    renderAt(`/practice/${saved!.id}`)
    expect(await screen.findByText('문제 2 / 4')).toBeInTheDocument()
    // 이미 푼 문제는 채점 결과 그대로, 다시 고를 수 없다
    expect(screen.getByRole('status')).toHaveTextContent('오답입니다')
    expect(choice(1)).toBeDisabled()
    // 진행 바: 2문제 풀이
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')

    // 이전으로 가도 1번은 정답 상태 그대로
    fireEvent.click(screen.getByRole('button', { name: '◀ 이전' }))
    expect(progressLabel()).toHaveTextContent('문제 1 / 4')
    expect(screen.getByRole('status')).toHaveTextContent('정답입니다')

    // 끝까지 넘겨서 끝내기 → 안 푼 문제 2개 확인 창
    fireEvent.click(screen.getByRole('button', { name: '다음 ▶' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 ▶' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 ▶' }))
    expect(progressLabel()).toHaveTextContent('문제 4 / 4')
    fireEvent.click(screen.getByRole('button', { name: '끝내기' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('아직 풀지 않은 문제가 2개')
    fireEvent.click(screen.getByRole('button', { name: '끝내고 결과 보기' }))

    expect(screen.getByRole('heading', { name: '연습 결과' })).toBeInTheDocument()
    expect(screen.getByText('2문제 중 1개 정답 (50%)')).toBeInTheDocument()
    expect(screen.getByText(/안 푼 문제 2개/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '틀린 문제 1개' })).toBeInTheDocument()
    await waitFor(async () => expect((await storage.getSession(saved!.id))?.finishedAt).not.toBeNull())
    expect((await storage.getSession(saved!.id))?.score).toBe(1)
    // 풀이 기록도 회차 ID로 2건
    expect(await storage.listAttempts({ sessionId: saved!.id })).toHaveLength(2)
  })

  it('방금 푼 문제로 되돌아와도 다시 풀 수 없다', async () => {
    await freshStorage()
    const [q1] = SUBJECT1 as [Question]
    const s = createPracticeSession(SUBJECT1, NO_SHUFFLE)
    await storage.putSession(s)
    renderAt(`/practice/${s.id}`)
    await screen.findByText('문제 1 / 4')
    await answer(q1, q1.answer)
    fireEvent.click(screen.getByRole('button', { name: '다음 ▶' }))
    fireEvent.click(screen.getByRole('button', { name: '◀ 이전' }))
    expect(screen.queryByRole('button', { name: '제출' })).toBeNull()
    expect(choice(1)).toBeDisabled()
  })

  it('끝난 연습 주소로 들어오면 요약, 틀린 문제 다시 풀기는 새 회차', async () => {
    await freshStorage()
    const [q1, q2] = SUBJECT1 as [Question, Question]
    let s = createPracticeSession([q1, q2], NO_SHUFFLE)
    s = recordAnswer(recordAnswer(s, q1.id, wrongOf(q1)), q2.id, q2.answer)
    await storage.putSession(finishSession(s, allByRef))
    renderAt(`/practice/${s.id}`)
    expect(await screen.findByText('2문제 중 1개 정답 (50%)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '틀린 문제 다시 풀기' }))
    expect(await screen.findByText('문제 1 / 1')).toBeInTheDocument()
    const unfinished = await storage.listSessions({ unfinished: true })
    expect(unfinished.map((x) => x.questionRefs)).toEqual([[q1.id]])
  })

  it('진행 중인 연습이 있으면 설정 화면에서 이어 풀기 / 끝내기', async () => {
    await freshStorage()
    const s = moveTo(recordAnswer(createPracticeSession(SUBJECT1, NO_SHUFFLE), SUBJECT1[0]!.id, 1), 1)
    await storage.putSession(s)
    renderAt('/practice')
    const banner = (await screen.findByRole('heading', { name: '진행 중인 연습이 있습니다' })).closest('section')!
    expect(banner).toHaveTextContent('4문제 중 1문제 풀이')
    fireEvent.click(within(banner).getByRole('button', { name: '이어 풀기' }))
    expect(await screen.findByText('문제 2 / 4')).toBeInTheDocument()

    cleanup()
    renderAt('/practice')
    fireEvent.click(await screen.findByRole('button', { name: '끝내기' }))
    await waitFor(() => expect(screen.queryByText('진행 중인 연습이 있습니다')).toBeNull())
    expect(await storage.listSessions({ unfinished: true })).toEqual([])
  })

  it('새로 시작하면 이전에 진행 중이던 연습은 끝난 것으로 처리', async () => {
    await freshStorage()
    const old = createPracticeSession(SUBJECT1, NO_SHUFFLE)
    await storage.putSession(old)
    renderAt('/practice')
    fireEvent.click(await screen.findByRole('button', { name: '연습 시작' }))
    await screen.findByText('문제 1 / 4')
    const unfinished = await storage.listSessions({ unfinished: true })
    expect(unfinished).toHaveLength(1)
    expect(unfinished[0]?.id).not.toBe(old.id)
  })

  it('없는 회차 주소', async () => {
    await freshStorage()
    renderAt('/practice/없는-회차')
    expect(await screen.findByRole('heading', { name: '연습을 찾을 수 없습니다' })).toBeInTheDocument()
  })
})
