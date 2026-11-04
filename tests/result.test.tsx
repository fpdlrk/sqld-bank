import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import {
  createExamSession,
  recordAnswer,
  submitExam,
  toggleFlag,
  type ChoiceNumber,
  type Question,
  type Session,
} from '../src/domain'
import { createIndexedDbStorage, setStorage, type StorageAdapter } from '../src/storage'
import { indexByRef } from '../src/pages/Practice/loadQuestions'

const QS = [...BUILT_IN_QUESTIONS] as Question[] // 1과목 4 (앞) + 2과목 8
const S1 = QS.filter((q) => q.subject === 1)
const S2 = QS.filter((q) => q.subject === 2)
const wrongOf = (q: Question) => ((q.answer % 4) + 1) as ChoiceNumber
const start = new Date('2026-11-03T10:00:00.000Z')

/**
 * 1과목: 3문항 정답, 1문항 안 품 / 2과목: 5문항 정답, 2문항 오답, 1문항 안 품
 * → 8/12 정답, 16점 / 24점. 1과목 6/8점(75%), 2과목 10/16점(62.5%) → 합격
 * 첫 문제는 보기를 거꾸로 보여 준 것으로 저장 (정오표 기호 확인용)
 */
function submittedExam(): Session {
  let s = createExamSession(QS, { shuffleChoices: false, now: start })
  s = { ...s, progress: { ...s.progress!, choiceOrders: { [QS[0]!.id]: [4, 3, 2, 1] } } }
  S1.slice(0, 3).forEach((q) => (s = recordAnswer(s, q.id, q.answer)))
  S2.slice(0, 5).forEach((q) => (s = recordAnswer(s, q.id, q.answer)))
  S2.slice(5, 7).forEach((q) => (s = recordAnswer(s, q.id, wrongOf(q))))
  s = toggleFlag(s, S2[5]!.id)
  return submitExam(s, indexByRef(QS), new Date(start.getTime() + 42 * 60_000)).session
}

let n = 0
let storage: StorageAdapter
async function setup(session: Session) {
  storage = createIndexedDbStorage(`result-${++n}`)
  setStorage(storage)
  await storage.putSession(session)
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/result/${session.id}`]}>
        <AppRoutes />
      </MemoryRouter>
    </ThemeProvider>,
  )
  await screen.findByRole('heading', { name: '모의고사 결과' })
}
afterEach(() => setStorage(undefined))

const rows = () => within(screen.getByRole('heading', { name: '문항별 정오표' }).closest('section')!).getAllByRole('listitem')

describe('T5-4 결과 화면', () => {
  it('판정·총점·정답 수·걸린 시간', async () => {
    await setup(submittedExam())
    const verdict = screen.getByRole('region', { name: '판정' })
    expect(verdict).toHaveTextContent('합격')
    expect(verdict).toHaveTextContent('16점 / 24점')
    expect(verdict).toHaveTextContent('8 / 12문항 정답 · 걸린 시간 42분')
  })

  it('과목별 점수·정답률·과락 기준', async () => {
    await setup(submittedExam())
    const s1 = screen.getByRole('heading', { name: '1과목' }).closest('section')!
    expect(s1).toHaveTextContent('6 / 8점통과')
    expect(within(s1).getByRole('progressbar', { name: '정답률 75%' })).toBeInTheDocument()
    const s2 = screen.getByRole('heading', { name: '2과목' }).closest('section')!
    expect(s2).toHaveTextContent('10 / 16점통과')
    expect(s2).toHaveTextContent('과락 기준 7점 미만') // 16점의 40% = 6.4 → 7점부터 통과
  })

  it('과락이면 불합격과 과락 과목을 보여 준다', async () => {
    let s = createExamSession(QS, { shuffleChoices: false, now: start })
    S2.forEach((q) => (s = recordAnswer(s, q.id, q.answer))) // 1과목 0문항
    await setup(submitExam(s, indexByRef(QS), start).session)
    expect(screen.getByRole('region', { name: '판정' })).toHaveTextContent('불합격 (과락: 1과목)')
    expect(screen.getByRole('heading', { name: '1과목' }).closest('section')).toHaveTextContent('과락')
  })

  it('단원별 정답률 표', async () => {
    await setup(submittedExam())
    const table = within(screen.getByRole('heading', { name: '단원별 정답률' }).closest('section')!).getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(QS.length + 1) // 샘플은 단원마다 1문항
  })

  it('정오표: 정답 ○ / 오답 ✕ / 미응답 — 개수, 거르기', async () => {
    await setup(submittedExam())
    expect(rows()).toHaveLength(12)
    expect(screen.getAllByLabelText('정답')).toHaveLength(8)
    expect(screen.getAllByLabelText('오답')).toHaveLength(2)
    expect(screen.getAllByLabelText('미응답')).toHaveLength(2)

    fireEvent.click(screen.getByRole('radio', { name: '오답 (틀림·안 품)' }))
    expect(rows()).toHaveLength(4)
    fireEvent.click(screen.getByRole('radio', { name: '안 푼 문제' }))
    expect(rows()).toHaveLength(2)
    fireEvent.click(screen.getByRole('radio', { name: '표시한 문제' }))
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent(S2[5]!.topic)
  })

  it('번호는 시험 때 보이던 보기 순서 기준, 줄을 누르면 문제·해설이 펼쳐진다', async () => {
    await setup(submittedExam())
    const first = rows()[0]!
    // 첫 문제는 거꾸로 보였으므로 원래 정답 번호 n → 화면 기호 (5-n)
    const shownMark = '①②③④'[4 - QS[0]!.answer]
    expect(first).toHaveTextContent(`내 답 ${shownMark} · 정답 ${shownMark}`)
    fireEvent.click(within(first).getByRole('button', { expanded: false }))
    expect(within(first).getByRole('article', { name: '문제 1' })).toBeInTheDocument()
    expect(within(first).getByRole('status')).toHaveTextContent('정답입니다')
    expect(within(first).getByText(QS[0]!.examPoint)).toBeInTheDocument()
  })

  it('틀린·안 푼 문제 다시 풀기 → 그 문제들로 연습 시작', async () => {
    const session = submittedExam()
    await setup(session)
    fireEvent.click(screen.getByRole('button', { name: '틀린·안 푼 문제 4개 다시 풀기' }))
    expect(await screen.findByText('문제 1 / 4')).toBeInTheDocument()
    const practice = (await storage.listSessions({ mode: 'practice' }))[0]!
    expect(practice.questionRefs).toEqual([S1[3]!.id, S2[5]!.id, S2[6]!.id, S2[7]!.id])
  })

  it('제출하지 않은 시험이면 이어 풀기로 안내', async () => {
    const s = createExamSession(QS)
    storage = createIndexedDbStorage(`result-${++n}`)
    setStorage(storage)
    await storage.putSession(s)
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={[`/result/${s.id}`]}>
          <AppRoutes />
        </MemoryRouter>
      </ThemeProvider>,
    )
    expect(await screen.findByText('아직 제출하지 않은 시험입니다.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '이어 풀기' })).toHaveAttribute('href', `/exam/${s.id}`)
  })
})
