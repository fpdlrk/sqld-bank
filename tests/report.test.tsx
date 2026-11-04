import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import { buildWrongNote, emptyNote, reportedNotes, setBookmark, setMemo, setReport, type Note } from '../src/domain'
import { QuestionPlayer } from '../src/pages/Practice/QuestionPlayer'
import { createIndexedDbStorage, setStorage, type StorageAdapter } from '../src/storage'

const q = BUILT_IN_QUESTIONS.find((x) => x.id === 'S1-05-0001')!
const t = (iso: string) => new Date(iso)
const choiceButtons = () => within(screen.getByRole('list', { name: '보기' })).getAllByRole('button')

describe('T7-5 신고 저장 규칙', () => {
  it('신고 남기기·고치기·취소 — 메모·북마크는 그대로', () => {
    let n = setMemo(setBookmark(emptyNote('S1-05-0001'), true), '내 메모')
    n = setReport(n, { kind: 'answer', detail: '  3번도 맞음  ' }, t('2026-11-04T01:00:00.000Z'))
    expect(n.report).toEqual({ kind: 'answer', detail: '3번도 맞음', at: '2026-11-04T01:00:00.000Z' })
    expect(n).toMatchObject({ bookmarked: true, memo: '내 메모', updatedAt: '2026-11-04T01:00:00.000Z' })

    n = setReport(n, null, t('2026-11-04T02:00:00.000Z'))
    expect(n.report).toBeUndefined()
    expect('report' in n).toBe(false)
    expect(n).toMatchObject({ bookmarked: true, memo: '내 메모' })
  })

  it('신고만 있는 문제는 오답노트에 나오지 않는다', () => {
    const note = setReport(emptyNote('S1-05-0001'), { kind: 'typo', detail: '' })
    expect(buildWrongNote([], [note], () => ({ chapter: 'S1-05', subject: 1, topic: '' }) as never)).toEqual([])
  })

  it('신고 모아 보기: 신고 있는 것만, 최근 신고부터', () => {
    const notes: Note[] = [
      setReport(emptyNote('A'), { kind: 'sql', detail: '' }, t('2026-11-01T00:00:00.000Z')),
      emptyNote('B'),
      setReport(emptyNote('TP03#42'), { kind: 'other', detail: '' }, t('2026-11-03T00:00:00.000Z')),
    ]
    expect(reportedNotes(notes).map((n) => n.questionRef)).toEqual(['TP03#42', 'A'])
  })
})

let n = 0
afterEach(() => setStorage(undefined))

describe('T7-5 풀이 화면의 [문제 오류 의심]', () => {
  it('채점 뒤 버튼 → 종류·사유 → 저장 → 신고함 표시, 고치기·취소', async () => {
    const storage = createIndexedDbStorage(`report-${++n}`)
    await storage.putNote(setMemo(emptyNote(q.id), '기존 메모'))
    render(<QuestionPlayer question={q} sessionId="s1" mode="practice" storage={storage} />)

    // 제출 전에는 없음
    expect(screen.queryByRole('button', { name: '문제 오류 의심' })).toBeNull()
    fireEvent.click(choiceButtons()[0]!)
    fireEvent.click(screen.getByRole('button', { name: '제출' }))

    fireEvent.click(await screen.findByRole('button', { name: '문제 오류 의심' }))
    const form = screen.getByRole('form', { name: '문제 오류 신고' })
    fireEvent.click(within(form).getByRole('radio', { name: '해설이 틀림·부족' }))
    fireEvent.change(within(form).getByLabelText(/사유/), { target: { value: '두 번째 문단 설명이 반대' } })
    fireEvent.click(within(form).getByRole('button', { name: '신고 저장' }))

    const box = await screen.findByRole('note', { name: '오류 신고함' })
    expect(box).toHaveTextContent('오류 신고함 · 해설이 틀림·부족 — 두 번째 문단 설명이 반대')
    const saved = await storage.getNote(q.id)
    expect(saved).toMatchObject({ memo: '기존 메모', report: { kind: 'explanation', detail: '두 번째 문단 설명이 반대' } })

    // 고치기: 이전 내용이 채워져 있다
    fireEvent.click(within(box).getByRole('button', { name: '고치기' }))
    expect(screen.getByLabelText(/사유/)).toHaveValue('두 번째 문단 설명이 반대')
    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    fireEvent.click(within(await screen.findByRole('note', { name: '오류 신고함' })).getByRole('button', { name: '신고 취소' }))
    expect(await screen.findByRole('button', { name: '문제 오류 의심' })).toBeInTheDocument()
    expect((await storage.getNote(q.id))?.report).toBeUndefined()
  })
})

describe('T7-5 문제 관리에서 모아 보기', () => {
  let storage: StorageAdapter
  async function open(notes: Note[]) {
    storage = createIndexedDbStorage(`report-bank-${++n}`)
    for (const x of notes) await storage.putNote(x)
    setStorage(storage)
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/bank']}>
          <AppRoutes />
        </MemoryRouter>
      </ThemeProvider>,
    )
    await screen.findByRole('heading', { name: '문제 관리' })
  }

  it('신고가 없으면 카드가 없다', async () => {
    await open([emptyNote(q.id)])
    expect(screen.queryByRole('heading', { name: /오류 신고/ })).toBeNull()
  })

  it('신고 목록 — 문제 이름·종류·사유, 문제 보기, 신고 지우기', async () => {
    await open([
      setReport(setMemo(emptyNote(q.id), '메모 유지'), { kind: 'answer', detail: '정답이 ②인 듯' }, t('2026-11-03T00:00:00.000Z')),
      setReport(emptyNote('TP01#7'), { kind: 'sql', detail: '' }, t('2026-11-02T00:00:00.000Z')),
    ])
    const card = (await screen.findByRole('heading', { name: '오류 신고 2개' })).closest('section')!
    const items = within(card).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent(`S1-05-0001 · ${q.topic}`)
    expect(items[0]).toHaveTextContent('정답이 틀림 — 정답이 ②인 듯')
    expect(items[1]).toHaveTextContent(/변형 문제 TP01 · .* \(시드 7\)/)
    expect(items[1]).toHaveTextContent('SQL·실행 결과 오류')

    // 고정 문제 미리보기
    fireEvent.click(within(items[0]!).getByRole('button', { name: '문제 보기' }))
    expect(await within(items[0]!).findByText(/시험 포인트/)).toBeInTheDocument()

    fireEvent.click(within(items[0]!).getByRole('button', { name: '신고 지우기' }))
    expect(await screen.findByRole('heading', { name: '오류 신고 1개' })).toBeInTheDocument()
    await waitFor(async () => expect((await storage.getNote(q.id))?.report).toBeUndefined())
    expect((await storage.getNote(q.id))?.memo).toBe('메모 유지')
  })
})
