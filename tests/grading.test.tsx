import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import { AnswerFeedback, QuestionView, formatSeconds } from '../src/components'
import { createAttempt, elapsedSeconds, isCorrect, type Question } from '../src/domain'
import { createIndexedDbStorage } from '../src/storage'
import { QuestionPlayer } from '../src/pages/Practice/QuestionPlayer'

const byId = (id: string) => BUILT_IN_QUESTIONS.find((q) => q.id === id) as Question
const q = byId('S1-03-0001') // 정답 ③
const choiceButtons = () => within(screen.getByRole('list', { name: '보기' })).getAllByRole('button')

describe('T3-2 채점 함수', () => {
  it('정답 판정 — 안 고른 문항은 오답', () => {
    expect(isCorrect(q, q.answer)).toBe(true)
    expect(isCorrect(q, q.answer === 1 ? 2 : 1)).toBe(false)
    expect(isCorrect(q, null)).toBe(false)
  })

  it('소요 시간은 초 단위 반올림, 음수는 0', () => {
    expect(elapsedSeconds(0, 12_400)).toBe(12)
    expect(elapsedSeconds(0, 12_600)).toBe(13)
    expect(elapsedSeconds(5_000, 1_000)).toBe(0)
  })

  it('풀이 기록 1건을 만든다', () => {
    const shown = Date.parse('2026-11-03T10:00:00.000Z')
    const a = createAttempt({ question: q, chosen: 3, sessionId: 's1', mode: 'practice', shownAtMs: shown, submittedAtMs: shown + 45_000 })
    expect(a).toMatchObject({
      questionRef: 'S1-03-0001',
      sessionId: 's1',
      mode: 'practice',
      chosen: 3,
      correct: true,
      elapsedSec: 45,
      at: '2026-11-03T10:00:45.000Z',
    })
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('T3-2 채점 표시 (QuestionView answer)', () => {
  it('오답을 고르면 정답은 "정답", 고른 보기는 "내 답"이 붙고 모두 잠긴다', () => {
    render(<QuestionView question={q} selected={1} answer={3} />)
    const [b1, , b3] = choiceButtons()
    expect(b1).toHaveTextContent('내 답')
    expect(b3).toHaveTextContent('정답')
    expect(choiceButtons().every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
  })

  it('정답을 고르면 "정답 · 내 답"', () => {
    render(<QuestionView question={q} selected={3} answer={3} />)
    expect(choiceButtons()[2]).toHaveTextContent('정답 · 내 답')
    expect(screen.queryByText('내 답')).toBeNull()
  })
})

describe('T3-2 해설 (AnswerFeedback)', () => {
  it('정답이면 "정답입니다", 해설·시험 포인트가 펼쳐져 있다', () => {
    render(<AnswerFeedback question={q} chosen={3} elapsedSec={75} />)
    expect(screen.getByRole('status')).toHaveTextContent('정답입니다')
    expect(screen.getByRole('status')).toHaveTextContent('1분 15초')
    expect(screen.getByText(q.examPoint)).toBeVisible()
  })

  it('오답이면 정답 위치를 "보이는 순서" 기호로 알려 준다', () => {
    // 보기를 거꾸로 보여 줬다면 원래 ③은 두 번째 위치 → ②
    render(<AnswerFeedback question={q} chosen={1} order={[4, 3, 2, 1]} />)
    expect(screen.getByRole('status')).toHaveTextContent('오답입니다 — 정답은 ②')
  })

  it('해설 접기·펼치기', () => {
    render(<AnswerFeedback question={q} chosen={1} />)
    const toggle = screen.getByRole('button', { name: /해설 접기/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: /해설 보기/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(q.examPoint)).not.toBeVisible()
  })

  it('시간 표시', () => {
    expect(formatSeconds(8)).toBe('8초')
    expect(formatSeconds(60)).toBe('1분 0초')
  })
})

describe('T3-2 한 문제 풀기 (QuestionPlayer)', () => {
  let n = 0
  const setup = (question: Question = q) => {
    const storage = createIndexedDbStorage(`grading-${++n}`)
    let clock = Date.parse('2026-11-03T10:00:00.000Z')
    const now = () => clock
    const advance = (ms: number) => (clock += ms)
    const onSubmitted = vi.fn()
    const utils = render(
      <QuestionPlayer question={question} sessionId="s1" mode="practice" storage={storage} now={now} onSubmitted={onSubmitted} footer={<button>다음 문제</button>} />,
    )
    return { storage, advance, onSubmitted, ...utils }
  }

  it('보기를 고르기 전에는 제출할 수 없다', () => {
    setup()
    expect(screen.getByRole('button', { name: '보기를 고르세요' })).toBeDisabled()
  })

  it('고르기 → 제출 → 채점·해설 표시 → 풀이 기록 저장 (소요 시간 포함)', async () => {
    const { storage, advance, onSubmitted } = setup()
    fireEvent.click(choiceButtons()[0]!) // ① (오답)
    fireEvent.click(choiceButtons()[2]!) // 마음을 바꿔 ③ (정답)
    advance(42_000)
    fireEvent.click(screen.getByRole('button', { name: '제출' }))

    expect(screen.getByRole('status')).toHaveTextContent('정답입니다')
    expect(screen.getByRole('button', { name: '다음 문제' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '제출' })).toBeNull()
    expect(onSubmitted).toHaveBeenCalledTimes(1)

    await waitFor(async () => expect(await storage.listAttempts()).toHaveLength(1))
    const [saved] = await storage.listAttempts({ sessionId: 's1' })
    expect(saved).toMatchObject({ questionRef: 'S1-03-0001', chosen: 3, correct: true, elapsedSec: 42, mode: 'practice' })
  })

  it('채점 후에는 답을 바꿀 수 없다', async () => {
    setup()
    fireEvent.click(choiceButtons()[0]!)
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    fireEvent.click(choiceButtons()[2]!)
    expect(choiceButtons()[0]).toHaveTextContent('내 답')
    expect(screen.getByRole('status')).toHaveTextContent('오답입니다')
  })

  it('저장에 실패해도 채점은 보이고 안내가 뜬다', async () => {
    const broken = createIndexedDbStorage('grading-broken')
    broken.addAttempt = () => Promise.reject(new Error('저장 불가'))
    render(<QuestionPlayer question={q} sessionId="s1" mode="practice" storage={broken} />)
    fireEvent.click(choiceButtons()[2]!)
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    expect(screen.getByRole('status')).toHaveTextContent('정답입니다')
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다')
  })

  it('문제가 바뀌면 고른 답·채점 상태가 처음으로 돌아간다', () => {
    const { rerender, storage } = setup()
    fireEvent.click(choiceButtons()[0]!)
    fireEvent.click(screen.getByRole('button', { name: '제출' }))
    rerender(<QuestionPlayer question={byId('M1-01-0001')} sessionId="s1" mode="practice" storage={storage} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(choiceButtons().every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true)
  })
})
