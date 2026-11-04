import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import {
  EXAM_SETTINGS_KEY,
  createExamSession,
  examRemaining,
  recordAnswer,
  submitExam,
  toggleFlag,
  type Question,
} from '../src/domain'
import { setSqlEngineLoader } from '../src/engine'
import { createIndexedDbStorage, setStorage, type StorageAdapter } from '../src/storage'
import { indexByRef } from '../src/pages/Practice/loadQuestions'
import { submitAndSave } from '../src/pages/Exam/examData'
import { useNodeSqlEngine } from './helpers/nodeSqlEngine'

const QS = [...BUILT_IN_QUESTIONS] as Question[] // 1과목 4 + 2과목 8
const byRef = indexByRef(QS)
const MIN = 60_000

describe('T5-3 모의고사 회차 함수', () => {
  const start = new Date('2026-11-03T10:00:00.000Z')

  it('새 회차: 모드 exam, 종료 시각 = 시작 + 90분, 보기 순서 저장', () => {
    const s = createExamSession(QS, { now: start })
    expect(s.mode).toBe('exam')
    expect(s.progress?.endsAt).toBe('2026-11-03T11:30:00.000Z')
    expect(Object.keys(s.progress?.choiceOrders ?? {})).toHaveLength(QS.length)
    expect(examRemaining(s, start)).toBe(5400)
  })

  it('표시하기 켜기/끄기', () => {
    const s = createExamSession(QS)
    const on = toggleFlag(s, QS[0]!.id)
    expect(on.progress?.flagged).toEqual([QS[0]!.id])
    expect(toggleFlag(on, QS[0]!.id).progress?.flagged).toEqual([])
  })

  it('제출: 채점 결과·과목별 점수·문항별 기록 (안 푼 문항은 chosen null)', () => {
    let s = createExamSession(QS, { now: start })
    for (const q of QS.slice(0, 3)) s = recordAnswer(s, q.id, q.answer) // 1과목 3문항 정답
    s = recordAnswer(s, QS[5]!.id, ((QS[5]!.answer % 4) + 1) as 1) // 하나 오답
    const { session, grade, attempts } = submitExam(s, byRef, new Date(start.getTime() + 30 * MIN))
    expect(grade.totalCorrect).toBe(3)
    expect(session).toMatchObject({ score: 3, subjectScores: { 1: 6, 2: 0 }, passed: false, finishedAt: '2026-11-03T10:30:00.000Z' })
    expect(attempts).toHaveLength(QS.length)
    expect(attempts.filter((a) => a.chosen === null)).toHaveLength(QS.length - 4)
    expect(attempts.every((a) => a.mode === 'exam' && a.sessionId === s.id)).toBe(true)
    expect(attempts[0]?.elapsedSec).toBe(Math.round((30 * 60) / QS.length))
  })

  it('시간이 지난 뒤 제출되면(자동 제출) 끝난 시각은 종료 시각', () => {
    const s = createExamSession(QS, { now: start })
    const { session } = submitExam(s, byRef, new Date(start.getTime() + 200 * MIN))
    expect(session.finishedAt).toBe('2026-11-03T11:30:00.000Z')
  })
})

// ───────────── 화면 ─────────────

let n = 0
let storage: StorageAdapter
beforeAll(() => useNodeSqlEngine())
afterAll(() => setSqlEngineLoader(undefined))
afterEach(() => setStorage(undefined))

async function freshStorage() {
  storage = createIndexedDbStorage(`exam-${++n}`)
  setStorage(storage)
}
/** 보기 순서를 섞지 않은 시험 회차 저장 (startedMinutesAgo분 전에 시작) */
async function saveExam(startedMinutesAgo = 0) {
  const s = createExamSession(QS, { shuffleChoices: false, now: new Date(Date.now() - startedMinutesAgo * MIN) })
  await storage.putSession(s)
  return s
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
const navButton = (no: number) => within(screen.getByRole('navigation', { name: '문항 이동' })).getByRole('button', { name: new RegExp(`^${no}번 `) })
/** 결과 화면(T5-4)의 판정 영역 (불러온 뒤에 나타난다) */
const resultCard = async () => screen.findByRole('region', { name: '판정' })
const timer = () => screen.getByTestId('exam-timer').textContent

describe('T5-3 시험 화면', () => {
  it('남은 시간 표시, 답 고르기·바꾸기, 표시하기, 문항 이동 패널 상태', async () => {
    await freshStorage()
    const s = await saveExam()
    renderAt(`/exam/${s.id}`)
    await screen.findByText('문제 1', { exact: false })
    expect(['90:00', '89:59']).toContain(timer())

    fireEvent.click(choice(2))
    fireEvent.click(choice(3)) // 답 바꾸기
    expect(choice(3)).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '☆ 표시하기' }))
    expect(navButton(1)).toHaveAccessibleName('1번 (푼 문항, 표시함, 현재 문항)')
    expect(navButton(2)).toHaveAccessibleName('2번 (안 푼 문항)')

    fireEvent.click(navButton(5)) // 패널로 이동
    expect(screen.getByRole('article', { name: '문제 5' })).toBeInTheDocument()
    await waitFor(async () => expect((await storage.getSession(s.id))?.progress?.currentIndex).toBe(4))
    const saved = await storage.getSession(s.id)
    expect(saved?.progress?.answers[QS[0]!.id]).toBe(3)
    expect(saved?.progress?.flagged).toEqual([QS[0]!.id])
  })

  it('새로고침해도 답안·표시·현재 문항·남은 시간이 그대로', async () => {
    await freshStorage()
    let s = await saveExam(20) // 20분 전에 시작
    s = toggleFlag(recordAnswer(s, QS[1]!.id, 4), QS[1]!.id)
    s = { ...s, progress: { ...s.progress!, currentIndex: 1 } }
    await storage.putSession(s)

    renderAt(`/exam/${s.id}`)
    await screen.findByRole('article', { name: '문제 2' })
    expect(choice(4)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '★ 표시함' })).toBeInTheDocument()
    expect(['70:00', '69:59']).toContain(timer())
  })

  it('제출 확인 창(안 푼 문항 수) → 제출 → 결과 화면, 기록 저장, 시험 주소는 결과로 이동', async () => {
    await freshStorage()
    const s = await saveExam()
    renderAt(`/exam/${s.id}`)
    await screen.findByText('문제 1', { exact: false })
    fireEvent.click(choice(QS[0]!.answer))
    fireEvent.click(screen.getAllByRole('button', { name: '제출' })[0]!)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(`아직 풀지 않은 문항이 ${QS.length - 1}개`)
    fireEvent.click(within(dialog).getByRole('button', { name: '제출' }))

    expect(await resultCard()).toHaveTextContent(/\d+점 \/ \d+점/)
    const subject1 = screen.getByRole('heading', { name: '1과목' }).closest('section')!
    expect(subject1).toHaveTextContent('2 / 8점')
    const done = await storage.getSession(s.id)
    expect(done?.finishedAt).not.toBeNull()
    expect(await storage.listAttempts({ sessionId: s.id })).toHaveLength(QS.length)

    cleanup()
    renderAt(`/exam/${s.id}`)
    expect(await resultCard()).toHaveTextContent(/\d+점 \/ \d+점/)
  })

  it('남은 10분 이하면 경고', async () => {
    await freshStorage()
    const s = await saveExam(85)
    renderAt(`/exam/${s.id}`)
    expect(await screen.findByText(/남은 시간이 10분 이하입니다/)).toBeInTheDocument()
  })

  it('시간이 끝난 시험을 열면 바로 자동 제출된다', async () => {
    await freshStorage()
    const s = await saveExam(120)
    renderAt(`/exam/${s.id}`)
    expect(await resultCard()).toHaveTextContent(/\d+점 \/ \d+점/)
    expect((await storage.getSession(s.id))?.finishedAt).toBe(s.progress?.endsAt)
  })

  it('제출이 겹쳐도(시간 종료 + 버튼) 기록은 한 번만 저장된다', async () => {
    await freshStorage()
    const s = await saveExam()
    await Promise.all([submitAndSave({ session: s, questionsByRef: byRef })])
    await submitAndSave({ session: s, questionsByRef: byRef })
    expect(await storage.listAttempts({ sessionId: s.id })).toHaveLength(QS.length)
  })
})

describe('T5-3 시작 화면', () => {
  it('변형 문제 비율을 고르고 시작하면 회차를 만들어 시험 화면으로 (설정 기억)', async () => {
    await freshStorage()
    renderAt('/exam')
    fireEvent.click(await screen.findByRole('radio', { name: '50%' }))
    fireEvent.click(screen.getByRole('button', { name: '시험 시작' }))
    await screen.findByText('⏱', { exact: false }, { timeout: 10_000 })
    const [s] = await storage.listSessions({ mode: 'exam' })
    expect(s?.questionRefs.length).toBeGreaterThan(40) // 1과목 4 + 2과목 40
    expect(await storage.getMeta(EXAM_SETTINGS_KEY)).toEqual({ templateRatio: 0.5 })
  })

  it('제출하지 않은 시험이 있으면 이어 풀기 / 지금 제출하기', async () => {
    await freshStorage()
    const s = await saveExam(10)
    renderAt('/exam')
    const card = (await screen.findByRole('heading', { name: '제출하지 않은 시험이 있습니다' })).closest('section')!
    expect(card).toHaveTextContent(/남은 시간 (80:00|79:59)/)
    fireEvent.click(within(card).getByRole('button', { name: '지금 제출하기' }))
    expect(await resultCard()).toHaveTextContent(/\d+점 \/ \d+점/)
    expect((await storage.getSession(s.id))?.finishedAt).not.toBeNull()
  })
})
