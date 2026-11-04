import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import { QUESTIONS_FILE_FORMAT, buildQuestionsFile, fileDate, type UserQuestion } from '../src/domain'
import { parseQuestionsFile, planImport } from '../src/domain/questionImport'
import { createIndexedDbStorage, setStorage, type StorageAdapter } from '../src/storage'

const base = BUILT_IN_QUESTIONS.find((q) => q.id === 'S1-05-0001')!
const user = (id: string, over: Partial<UserQuestion> = {}): UserQuestion => ({
  ...base,
  id,
  source: 'user',
  topic: `주제 ${id}`,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
})
const NOW = new Date('2026-11-04T09:00:00.000Z')

describe('T7-3 파일 형식', () => {
  it('내보내기: 형식·버전·시각, ID 순', () => {
    const f = buildQuestionsFile([user('U-S1-05-0002'), user('U-S1-05-0001')], NOW)
    expect(f).toMatchObject({ format: QUESTIONS_FILE_FORMAT, version: 1, exportedAt: NOW.toISOString() })
    expect(f.questions.map((q) => q.id)).toEqual(['U-S1-05-0001', 'U-S1-05-0002'])
    expect(fileDate(new Date(2026, 10, 4))).toBe('20261104')
  })

  it('읽기: 내보낸 파일·문제 배열은 받고, 그 밖은 이유를 알려 준다', () => {
    expect(parseQuestionsFile(JSON.stringify(buildQuestionsFile([user('U-S1-05-0001')])))).toMatchObject({ ok: true, items: [{ id: 'U-S1-05-0001' }] })
    expect(parseQuestionsFile('[1,2]')).toEqual({ ok: true, items: [1, 2] })
    expect(parseQuestionsFile('{oops')).toMatchObject({ ok: false, message: expect.stringContaining('JSON 형식') })
    expect(parseQuestionsFile('{"a":1}')).toMatchObject({ ok: false, message: expect.stringContaining('문제 목록') })
  })
})

describe('T7-3 가져오기 계획', () => {
  it('기본 문제 형식(S1-05-0001, claude)은 직접 추가 문제로 바꾸고 새 번호', () => {
    const plan = planImport([base], [], 'renumber', NOW)
    expect(plan.ready).toHaveLength(1)
    expect(plan.ready[0]).toMatchObject({ id: 'U-S1-05-0001', source: 'user', createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() })
    expect(plan.renumbered).toBe(1)
  })

  it('틀린 문제는 몇 번째·어느 칸·이유와 함께 빼고, 나머지는 가져온다', () => {
    const plan = planImport([user('U-S1-05-0001'), { ...base, choices: ['a', 'a', 'b', 'c'] }, 'x'], [], 'renumber', NOW)
    expect(plan.ready.map((q) => q.id)).toEqual(['U-S1-05-0001'])
    expect(plan.invalid.map((i) => i.index)).toEqual([2, 3])
    expect(plan.invalid[0]).toMatchObject({ id: 'S1-05-0001', problems: [{ path: 'choices', message: '보기 4개가 서로 달라야 합니다' }] })
    expect(plan.total).toBe(3)
  })

  it('처음 만든 날은 파일에 있으면 그대로', () => {
    expect(planImport([user('U-S1-05-0001')], [], 'renumber', NOW).ready[0]?.createdAt).toBe('2026-10-01T00:00:00.000Z')
  })

  describe('ID가 겹칠 때', () => {
    const existing = ['U-S1-05-0001', 'U-S1-05-0002']
    const items = [user('U-S1-05-0001', { topic: '새 내용' }), user('U-S1-05-0005')]

    it('새 번호로 추가 (기본)', () => {
      const plan = planImport(items, existing, 'renumber', NOW)
      expect(plan.ready.map((q) => q.id)).toEqual(['U-S1-05-0006', 'U-S1-05-0005'])
      expect(plan).toMatchObject({ conflicts: 1, renumbered: 1, overwritten: 0, skipped: 0 })
    })

    it('덮어쓰기', () => {
      const plan = planImport(items, existing, 'overwrite', NOW)
      expect(plan.ready.map((q) => [q.id, q.topic])).toEqual([
        ['U-S1-05-0001', '새 내용'],
        ['U-S1-05-0005', '주제 U-S1-05-0005'],
      ])
      expect(plan).toMatchObject({ conflicts: 1, overwritten: 1 })
    })

    it('건너뛰기', () => {
      const plan = planImport(items, existing, 'skip', NOW)
      expect(plan.ready.map((q) => q.id)).toEqual(['U-S1-05-0005'])
      expect(plan).toMatchObject({ conflicts: 1, skipped: 1 })
    })

    it('파일 안에서 같은 ID가 두 번이면 둘 다 살리고 두 번째에 새 번호', () => {
      const plan = planImport([user('U-S1-05-0001'), user('U-S1-05-0001', { topic: '둘째' })], [], 'overwrite', NOW)
      expect(plan.ready.map((q) => q.id)).toEqual(['U-S1-05-0001', 'U-S1-05-0002'])
    })
  })

  it('내보낸 파일을 빈 앱에 가져오면 내용이 그대로 (updatedAt만 새로)', () => {
    const qs = [user('U-S1-05-0001'), user('U-S1-04-0003', { chapter: 'S1-04' })]
    const parsed = parseQuestionsFile(JSON.stringify(buildQuestionsFile(qs)))
    const plan = planImport(parsed.ok ? parsed.items : [], [], 'renumber', NOW)
    const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1)
    expect(plan.ready.map(({ updatedAt: _u, ...q }) => q).sort(byId)).toEqual(qs.map(({ updatedAt: _u, ...q }) => q).sort(byId))
  })

  it('앞 문제에 붙인 새 번호가 뒤 문제의 ID와 겹치지 않는다', () => {
    // 1번째: 기존과 겹침 → 새 번호, 3번째: 원래 U-S1-05-0003 → 그대로 써야 한다
    const plan = planImport([user('U-S1-05-0001'), base, user('U-S1-05-0003')], ['U-S1-05-0001', 'U-S1-05-0002'], 'renumber', NOW)
    const ids = plan.ready.map((q) => q.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids).toEqual(['U-S1-05-0004', 'U-S1-05-0005', 'U-S1-05-0003'])
  })
})

// ───────────── 화면 ─────────────

let n = 0
let storage: StorageAdapter
afterEach(() => {
  setStorage(undefined)
  vi.restoreAllMocks()
})
async function open(users: UserQuestion[] = []) {
  storage = createIndexedDbStorage(`import-${++n}`)
  for (const u of users) await storage.putUserQuestion(u)
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

describe('T7-3 문제 관리 화면에서 내보내기·가져오기', () => {
  it('내보내기: 직접 추가 문제가 없으면 잠김, 있으면 JSON 파일을 내려받는다', async () => {
    let blob: Blob | undefined
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b
      return 'blob:test'
    })
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await open([user('U-S1-05-0001')])
    const btn = await screen.findByRole('button', { name: 'JSON 내보내기' })
    await waitFor(() => expect(btn).toBeEnabled())
    fireEvent.click(btn)
    expect(click).toHaveBeenCalled()
    const file = JSON.parse(await blob!.text())
    expect(file.format).toBe(QUESTIONS_FILE_FORMAT)
    expect(file.questions.map((q: UserQuestion) => q.id)).toEqual(['U-S1-05-0001'])
    expect(screen.getByRole('status')).toHaveTextContent('직접 추가 문제 1개를 내보냈습니다.')
  })

  it('가져오기: 파일 고르기 → 검사 결과 → 가져오기 → 목록에 반영', async () => {
    await open([user('U-S1-05-0001')])
    fireEvent.click(screen.getByRole('button', { name: 'JSON 가져오기' }))
    const panel = (await screen.findByRole('heading', { name: '문제 JSON 가져오기' })).closest('section')!
    const content = JSON.stringify([user('U-S1-05-0001', { topic: '겹침' }), { ...base, id: 'S1-05-0009' }, { nope: 1 }])
    fireEvent.change(within(panel).getByLabelText(/JSON 파일/), {
      target: { files: [new File([content], 'my.json', { type: 'application/json' })] },
    })
    expect(await within(panel).findByText(/문제 3개 중/)).toHaveTextContent('my.json: 문제 3개 중 2개를 가져옵니다 · 오류 1개는 건너뜀 · ID 겹침 1개 · 새 번호 2개')
    expect(within(panel).getByText(/3번째 문제/)).toBeInTheDocument()

    // 겹치면 건너뛰기로 바꾸면 1개만
    fireEvent.click(within(panel).getByRole('radio', { name: '건너뛰기' }))
    expect(within(panel).getByRole('button', { name: '1문제 가져오기' })).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('radio', { name: '새 번호로 추가' }))
    fireEvent.click(within(panel).getByRole('button', { name: '2문제 가져오기' }))

    expect(await screen.findByText('2문제를 가져왔습니다.')).toBeInTheDocument()
    expect((await storage.listUserQuestions()).map((q) => q.id)).toEqual(['U-S1-05-0001', 'U-S1-05-0002', 'U-S1-05-0003'])
    expect(await screen.findByText(/직접 추가 3\)/)).toBeInTheDocument()
  })

  it('JSON이 아닌 파일은 이유를 알려 준다', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'JSON 가져오기' }))
    const panel = (await screen.findByRole('heading', { name: '문제 JSON 가져오기' })).closest('section')!
    fireEvent.change(within(panel).getByLabelText(/JSON 파일/), { target: { files: [new File(['hello'], 'a.json')] } })
    expect(await within(panel).findByRole('alert')).toHaveTextContent('a.json: JSON 형식이 아닙니다')
    expect(within(panel).getByRole('button', { name: '가져오기' })).toBeDisabled()
  })
})
