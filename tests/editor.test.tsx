import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import {
  draftFromQuestion,
  draftToCandidate,
  emptyDraft,
  nextUserQuestionId,
  parsePastedTable,
  tableToText,
  type UserQuestion,
} from '../src/domain'
import { validateQuestion } from '../src/domain/questionSchema'
import { createIndexedDbStorage, setStorage, type StorageAdapter } from '../src/storage'
import { fieldLabel } from '../src/pages/Bank/QuestionEditorPage'

describe('T7-2 표 붙여넣기', () => {
  it('엑셀(탭) — 첫 줄은 컬럼, 빈 칸·NULL은 NULL, 숫자는 숫자', () => {
    const r = parsePastedTable('EMPNO\tENAME\tSAL\tCODE\n1\tKIM\t3000\t007\n2\tLEE\tnull\t\n', ' EMP ')
    expect(r).toEqual({
      ok: true,
      table: { name: 'EMP', columns: ['EMPNO', 'ENAME', 'SAL', 'CODE'], rows: [[1, 'KIM', 3000, '007'], [2, 'LEE', null, null]] },
    })
  })

  it('쉼표(CSV)도 받고, 모자란 칸은 NULL로 채운다', () => {
    expect(parsePastedTable('A,B\n1.5,-2\n3')).toEqual({ ok: true, table: { columns: ['A', 'B'], rows: [[1.5, -2], [3, null]] } })
  })

  it('잘못된 표는 이유를 알려 준다', () => {
    expect(parsePastedTable('  ')).toEqual({ ok: false, message: '붙여 넣은 내용이 없습니다' })
    expect(parsePastedTable('A\t\tC\n1\t2\t3')).toMatchObject({ ok: false, message: expect.stringContaining('빈 칸') })
    expect(parsePastedTable('A\tA\n1\t2')).toMatchObject({ ok: false, message: '컬럼 이름이 겹칩니다' })
    expect(parsePastedTable('A\tB\n1\t2\t3')).toMatchObject({ ok: false, message: expect.stringContaining('2번째 줄') })
  })

  it('표 → 글자 → 표가 그대로 돌아온다 (수정할 때)', () => {
    const t = { name: 'T', columns: ['A', 'B'], rows: [[1, null], ['x', 2]] }
    expect(parsePastedTable(tableToText(t), 'T')).toEqual({ ok: true, table: t })
  })
})

describe('T7-2 폼 입력값 변환·검사', () => {
  it('ID는 그 단원의 다음 번호', () => {
    expect(nextUserQuestionId([], 'S1-05')).toBe('U-S1-05-0001')
    expect(nextUserQuestionId(['U-S1-05-0001', 'U-S1-05-0003', 'U-S1-04-0009'], 'S1-05')).toBe('U-S1-05-0004')
  })

  const filled = () => ({
    ...emptyDraft('U-S1-05-0001', 'S1-05' as const),
    topic: 'COUNT와 NULL',
    stem: '결과로 옳은 것은?',
    choices: ['1', '2', '3', '4'] as [string, string, string, string],
    answer: 2 as const,
    explanation: '정답은 ②입니다.',
    examPoint: 'COUNT(컬럼)은 NULL 제외',
  })

  it('빈 선택 항목(SQL·표·태그)은 넣지 않고, 과목은 단원에서 정하고, 태그는 쉼표로 나눈다', () => {
    const { candidate } = draftToCandidate({ ...filled(), tags: ' NULL , 집계 ,' })
    expect(candidate).toMatchObject({ subject: 2, source: 'user', tags: ['NULL', '집계'] })
    expect('sql' in candidate).toBe(false)
    expect('tables' in candidate).toBe(false)
    expect(validateQuestion(candidate).ok).toBe(true)
  })

  it('검사 실패: 칸 이름과 한국어 이유', () => {
    const { candidate } = draftToCandidate({ ...filled(), choices: ['1', '1', '3', '4'], answer: null, topic: '' })
    const r = validateQuestion(candidate)
    expect(r.ok).toBe(false)
    if (r.ok) return
    const labeled = r.problems.map((p) => `${fieldLabel(p.path)}: ${p.message}`)
    expect(labeled).toContain('보기: 보기 4개가 서로 달라야 합니다')
    expect(labeled.some((l) => l.startsWith('정답:'))).toBe(true)
    expect(labeled.some((l) => l.startsWith('세부 주제:'))).toBe(true)
  })

  it('표 붙여넣기 오류는 검사 전에 따로 알려 준다', () => {
    const { tableProblems } = draftToCandidate({ ...filled(), tables: [{ name: 'T', text: 'A\tA\n1\t2' }] })
    expect(tableProblems).toEqual([{ path: 'tables.0', message: '컬럼 이름이 겹칩니다' }])
    expect(fieldLabel('tables.0')).toBe('예시 테이블 1번째')
    expect(fieldLabel('choices.2')).toBe('보기 ③')
  })

  it('기본 문제를 폼 값으로 바꿨다 되돌려도 같은 문제 (표·SQL·태그 포함)', () => {
    const q = BUILT_IN_QUESTIONS.find((x) => x.id === 'S1-03-0001')!
    const { candidate } = draftToCandidate(draftFromQuestion(q))
    const r = validateQuestion({ ...candidate, source: 'claude', id: q.id })
    expect(r.ok && r.question.tables).toEqual(q.tables)
    expect(r.ok && r.question.sql).toBe(q.sql)
  })
})

// ───────────── 화면 ─────────────

let n = 0
let storage: StorageAdapter
afterEach(() => setStorage(undefined))
async function open(path: string, users: UserQuestion[] = []) {
  storage = createIndexedDbStorage(`editor-${++n}`)
  for (const u of users) await storage.putUserQuestion(u)
  setStorage(storage)
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </ThemeProvider>,
  )
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

const saved: UserQuestion = {
  ...BUILT_IN_QUESTIONS.find((q) => q.id === 'S1-05-0001')!,
  id: 'U-S1-05-0001',
  source: 'user',
  topic: '내 문제',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

describe('T7-2 문제 추가·수정 화면', () => {
  it('문제 관리 → + 문제 추가 → 빈 칸이면 저장 실패 목록 → 채우면 저장되고 목록에 직접 추가 문제로', async () => {
    await open('/bank')
    fireEvent.click(await screen.findByRole('button', { name: '+ 문제 추가' }))
    expect(await screen.findByRole('heading', { name: '문제 추가' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/단원/), { target: { value: 'S1-04' } })
    expect(screen.getByText('U-S1-04-0001')).toBeInTheDocument() // 단원에 맞춰 ID

    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('저장하지 못했습니다')
    expect(alert).toHaveTextContent('세부 주제:')
    expect(alert).toHaveTextContent('문제 본문:')

    type(/세부 주제/, 'BETWEEN 경계')
    type(/^본문/, '다음 SQL의 결과 행 수는?')
    fireEvent.click(screen.getByRole('button', { name: '+ 예시 테이블 추가' }))
    type('테이블 이름 (예: EMP)', 'T')
    type(/엑셀에서 복사해 붙여 넣기/, 'A\tB\n1\tNULL\n2\t3')
    expect(screen.getByText('[T]')).toBeInTheDocument() // 붙여 넣자마자 표로
    ;['1건', '2건', '3건', '4건'].forEach((v, i) => type(`보기 ${'①②③④'[i]}`, v))
    fireEvent.click(screen.getByLabelText('② 정답'))
    type(/^해설/, '정답은 ②입니다. BETWEEN은 양 끝을 포함합니다.')
    type(/시험 포인트/, 'BETWEEN은 양 끝 포함')
    type(/태그/, 'BETWEEN, WHERE')

    fireEvent.click(screen.getByRole('button', { name: '미리보기' }))
    const preview = screen.getByRole('heading', { name: '미리보기' }).closest('section')!
    expect(within(preview).getByRole('article')).toHaveTextContent('다음 SQL의 결과 행 수는?')

    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('heading', { name: '문제 관리' })).toBeInTheDocument()
    const q = await storage.getUserQuestion('U-S1-04-0001')
    expect(q).toMatchObject({ subject: 2, chapter: 'S1-04', answer: 2, tags: ['BETWEEN', 'WHERE'], source: 'user' })
    expect(q?.tables).toEqual([{ name: 'T', columns: ['A', 'B'], rows: [[1, null], [2, 3]] }])
    expect(await screen.findByText(/직접 추가 1\)/)).toBeInTheDocument()
  })

  it('수정: 값이 채워져 있고 단원은 잠김, 저장하면 바뀌고 처음 만든 날은 그대로', async () => {
    await open('/bank/edit/U-S1-05-0001', [saved])
    expect(await screen.findByRole('heading', { name: '문제 수정' })).toBeInTheDocument()
    expect(screen.getByLabelText(/단원/)).toBeDisabled()
    expect(screen.getByLabelText(/세부 주제/)).toHaveValue('내 문제')
    type(/세부 주제/, '고친 문제')
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await screen.findByRole('heading', { name: '문제 관리' })
    const q = await storage.getUserQuestion('U-S1-05-0001')
    expect(q?.topic).toBe('고친 문제')
    expect(q?.createdAt).toBe(saved.createdAt)
    expect(q?.updatedAt).not.toBe(saved.updatedAt)
  })

  it('기본 문제나 없는 문제는 수정할 수 없다', async () => {
    await open('/bank/edit/S1-05-0001')
    expect(await screen.findByRole('heading', { name: '문제를 찾을 수 없습니다' })).toBeInTheDocument()
  })

  it('목록에서 직접 추가 문제 삭제 (확인 창), 기본 문제에는 수정·삭제 버튼이 없다', async () => {
    await open('/bank', [saved])
    const row = (await screen.findByText('내 문제')).closest('li')!
    fireEvent.click(within(row).getByRole('button', { expanded: false }))
    fireEvent.click(within(row).getByRole('button', { name: '삭제' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(screen.queryByText('내 문제')).toBeNull())
    expect(await storage.getUserQuestion(saved.id)).toBeUndefined()

    const builtIn = screen.getByText(BUILT_IN_QUESTIONS[0]!.topic).closest('li')!
    fireEvent.click(within(builtIn).getByRole('button', { expanded: false }))
    expect(within(builtIn).queryByRole('button', { name: '수정' })).toBeNull()
  })
})
