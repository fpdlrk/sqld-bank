import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import {
  BACKUP_FILE_FORMAT,
  LAST_BACKUP_KEY,
  backupReminder,
  buildBackupFile,
  daysSince,
  mergeDumps,
  parseBackupFile,
  type Attempt,
  type DataDump,
  type Note,
  type Session,
  type UserQuestion,
} from '../src/domain'
import { SCHEMA_VERSION, createIndexedDbStorage, setStorage, type StorageAdapter } from '../src/storage'

const base = BUILT_IN_QUESTIONS.find((q) => q.id === 'S1-05-0001')!
const userQ = (id: string, createdAt: string, over: Partial<UserQuestion> = {}): UserQuestion => ({
  ...base,
  id,
  source: 'user',
  topic: `주제 ${id}`,
  createdAt,
  updatedAt: createdAt,
  ...over,
})
const attempt = (id: string, questionRef: string, at: string, sessionId = 's1'): Attempt => ({
  id,
  questionRef,
  sessionId,
  mode: 'practice',
  chosen: 1,
  correct: false,
  elapsedSec: 10,
  at,
})
const session = (id: string, over: Partial<Session> = {}): Session => ({
  id,
  mode: 'practice',
  startedAt: '2026-10-01T00:00:00.000Z',
  finishedAt: '2026-10-01T00:10:00.000Z',
  questionRefs: ['S1-05-0001'],
  score: 0,
  subjectScores: null,
  passed: null,
  ...over,
})
const note = (questionRef: string, memo: string, updatedAt: string): Note => ({
  questionRef,
  bookmarked: false,
  memo,
  mastered: false,
  updatedAt,
})
const dump = (over: Partial<DataDump> = {}): DataDump => ({
  schemaVersion: 1,
  exportedAt: '2026-10-20T00:00:00.000Z',
  attempts: [],
  sessions: [],
  notes: [],
  userQuestions: [],
  meta: [],
  ...over,
})

describe('T7-4 백업 파일 읽기', () => {
  it('이 앱이 만든 백업 파일은 받는다', () => {
    const d = dump({ attempts: [attempt('a1', 'S1-05-0001', '2026-10-01T00:00:00.000Z')] })
    const parsed = parseBackupFile(JSON.stringify(buildBackupFile(d)), SCHEMA_VERSION)
    expect(parsed).toEqual({ ok: true, dump: d })
  })

  it('JSON이 아니거나, 형식이 다르거나, 버전이 높거나, 표가 깨졌으면 이유를 알려 준다', () => {
    const msg = (text: string) => {
      const r = parseBackupFile(text, 1)
      return r.ok ? '' : r.message
    }
    expect(msg('{oops')).toContain('JSON 형식')
    expect(msg('[1,2]')).toContain('백업 파일이 아닙니다')
    expect(msg(JSON.stringify({ format: 'sqld-bank/questions', questions: [] }))).toContain('백업 파일이 아닙니다')
    expect(msg(JSON.stringify(buildBackupFile(dump({ schemaVersion: 2 }))))).toContain('더 새로운 버전(2)')
    expect(msg(JSON.stringify({ ...buildBackupFile(dump()), notes: [{ memo: 'x' }] }))).toContain('오답노트 부분이 손상')
    expect(msg(JSON.stringify({ ...buildBackupFile(dump()), attempts: null }))).toContain('풀이 기록 부분이 손상')
  })
})

describe('T7-4 합치기', () => {
  it('풀이 기록은 id로 하나만, 새 기록은 더한다', () => {
    const a1 = attempt('a1', 'S1-05-0001', '2026-10-01T00:00:00.000Z')
    const r = mergeDumps(dump({ attempts: [a1] }), dump({ attempts: [a1, attempt('a2', 'S1-05-0001', '2026-10-02T00:00:00.000Z')] }))
    expect(r.dump.attempts.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(r.added.attempts).toBe(1)
  })

  it('회차: 끝난 쪽, 둘 다 진행 중이면 더 많이 푼 쪽', () => {
    const open = (n: number) =>
      session('s1', { finishedAt: null, score: null, progress: { currentIndex: 0, answers: Object.fromEntries(Array.from({ length: n }, (_, i) => [`q${i}`, 1])) } as NonNullable<Session['progress']> })
    expect(mergeDumps(dump({ sessions: [open(1)] }), dump({ sessions: [session('s1')] })).dump.sessions[0]?.finishedAt).not.toBeNull()
    expect(mergeDumps(dump({ sessions: [session('s1')] }), dump({ sessions: [open(3)] })).dump.sessions[0]?.finishedAt).not.toBeNull()
    expect(Object.keys(mergeDumps(dump({ sessions: [open(1)] }), dump({ sessions: [open(3)] })).dump.sessions[0]?.progress?.answers ?? {})).toHaveLength(3)
  })

  it('오답노트·직접 추가 문제는 마지막으로 바뀐 쪽', () => {
    const r = mergeDumps(
      dump({
        notes: [note('S1-05-0001', '이 기기', '2026-10-05T00:00:00.000Z'), note('S1-05-0002', '이 기기 최신', '2026-10-09T00:00:00.000Z')],
        userQuestions: [userQ('U-S1-05-0001', '2026-10-01T00:00:00.000Z')],
      }),
      dump({
        notes: [note('S1-05-0001', '백업 최신', '2026-10-07T00:00:00.000Z'), note('S1-05-0002', '백업', '2026-10-08T00:00:00.000Z')],
        userQuestions: [userQ('U-S1-05-0001', '2026-10-01T00:00:00.000Z', { topic: '고친 주제', updatedAt: '2026-10-03T00:00:00.000Z' })],
      }),
    )
    expect(r.dump.notes.map((n) => n.memo)).toEqual(['백업 최신', '이 기기 최신'])
    expect(r.dump.userQuestions[0]?.topic).toBe('고친 주제')
    expect(r.added).toMatchObject({ notes: 0, userQuestions: 0 })
    expect(r.renamed).toEqual([])
  })

  it('ID만 같은 다른 문제(만든 날이 다름)는 새 번호 — 풀이 기록·오답노트·회차도 따라간다', () => {
    const mine = userQ('U-S1-05-0001', '2026-10-01T00:00:00.000Z')
    const theirs = userQ('U-S1-05-0001', '2026-10-02T00:00:00.000Z', { topic: '다른 기기 문제' })
    const r = mergeDumps(
      dump({ userQuestions: [mine], attempts: [attempt('a1', 'U-S1-05-0001', '2026-10-01T01:00:00.000Z')] }),
      dump({
        userQuestions: [theirs, userQ('U-S1-05-0002', '2026-10-02T00:00:00.000Z')],
        attempts: [attempt('b1', 'U-S1-05-0001', '2026-10-02T01:00:00.000Z', 's9')],
        notes: [note('U-S1-05-0001', '다른 기기 메모', '2026-10-02T02:00:00.000Z')],
        sessions: [session('s9', { questionRefs: ['U-S1-05-0001', 'S1-05-0001'] })],
      }),
    )
    // 파일 안의 0002를 피해서 0003
    expect(r.renamed).toEqual([['U-S1-05-0001', 'U-S1-05-0003']])
    expect(r.dump.userQuestions.map((q) => [q.id, q.topic])).toEqual([
      ['U-S1-05-0001', '주제 U-S1-05-0001'],
      ['U-S1-05-0003', '다른 기기 문제'],
      ['U-S1-05-0002', '주제 U-S1-05-0002'],
    ])
    expect(r.dump.attempts.map((a) => [a.id, a.questionRef])).toEqual([
      ['a1', 'U-S1-05-0001'],
      ['b1', 'U-S1-05-0003'],
    ])
    expect(r.dump.notes[0]?.questionRef).toBe('U-S1-05-0003')
    expect(r.dump.sessions[0]?.questionRefs).toEqual(['U-S1-05-0003', 'S1-05-0001'])
    expect(r.added.userQuestions).toBe(2)
  })

  it('설정은 이 기기 값 우선, 없는 항목만 추가', () => {
    const r = mergeDumps(
      dump({ meta: [{ key: 'examDate', value: '2026-11-20' }] }),
      dump({ meta: [{ key: 'examDate', value: '2026-12-01' }, { key: 'examSettings', value: { templateRatio: 0 } }] }),
    )
    expect(r.dump.meta).toEqual([
      { key: 'examDate', value: '2026-11-20' },
      { key: 'examSettings', value: { templateRatio: 0 } },
    ])
  })
})

describe('T7-4 백업 권장', () => {
  const now = new Date('2026-11-04T09:00:00.000Z')
  it('기록이 없으면 권하지 않는다', () => {
    expect(backupReminder(undefined, undefined, now)).toBeNull()
  })
  it('마지막 백업(없으면 첫 기록) 후 7일부터', () => {
    expect(backupReminder('2026-10-29T09:00:00.000Z', '2026-09-01T00:00:00.000Z', now)).toBeNull()
    expect(backupReminder('2026-10-28T09:00:00.000Z', '2026-09-01T00:00:00.000Z', now)).toBe(7)
    expect(backupReminder(undefined, '2026-11-01T00:00:00.000Z', now)).toBeNull()
    expect(backupReminder(undefined, '2026-10-20T00:00:00.000Z', now)).toBe(15)
    expect(daysSince('잘못된 값', now)).toBe(0)
  })
})

// ───────────── 화면 ─────────────

let n = 0
let storage: StorageAdapter
afterEach(() => {
  setStorage(undefined)
  vi.restoreAllMocks()
})
async function open(path: string, setup: (s: StorageAdapter) => Promise<void> = async () => {}) {
  storage = createIndexedDbStorage(`backup-${++n}`)
  await setup(storage)
  setStorage(storage)
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </ThemeProvider>,
  )
}
const fileOf = (d: DataDump, name = 'backup.json') => new File([JSON.stringify(buildBackupFile(d))], name, { type: 'application/json' })
const pickFile = (file: File) => fireEvent.change(screen.getByLabelText(/백업 파일 \(/), { target: { files: [file] } })

describe('T7-4 설정 화면', () => {
  it('백업: 파일을 내려받고 마지막 백업 시각을 기록한다', async () => {
    let blob: Blob | undefined
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b
      return 'blob:test'
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await open('/settings', async (s) => {
      await s.addAttempt(attempt('a1', 'S1-05-0001', '2026-10-01T00:00:00.000Z'))
      await s.putUserQuestion(userQ('U-S1-05-0001', '2026-10-01T00:00:00.000Z'))
    })
    expect(await screen.findByText('아직 백업한 적이 없습니다.')).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: '백업 파일 내려받기' })
    await waitFor(() => expect(btn).toBeEnabled())
    fireEvent.click(btn)

    expect(await screen.findByText(/백업 파일을 내려받았습니다/)).toBeInTheDocument()
    expect(await screen.findByText(/마지막 백업: .*\(오늘\)/)).toBeInTheDocument()
    const file = JSON.parse(await blob!.text())
    expect(file.format).toBe(BACKUP_FILE_FORMAT)
    expect(file.attempts).toHaveLength(1)
    expect(file.userQuestions).toHaveLength(1)
    expect(file.meta.map((m: { key: string }) => m.key)).toContain(LAST_BACKUP_KEY)
    expect(typeof (await storage.getMeta(LAST_BACKUP_KEY))).toBe('string')
  })

  it('복원(합치기): 지금 기록에 백업 기록을 더한다', async () => {
    await open('/settings', async (s) => {
      await s.addAttempt(attempt('a1', 'S1-05-0001', '2026-10-01T00:00:00.000Z'))
    })
    await screen.findByText('아직 백업한 적이 없습니다.')
    pickFile(fileOf(dump({ attempts: [attempt('a1', 'S1-05-0001', '2026-10-01T00:00:00.000Z'), attempt('a2', 'S1-05-0001', '2026-10-02T00:00:00.000Z')] })))
    expect(await screen.findByText(/backup.json: .*풀이 기록 2개/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '합치기' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: '합쳐서 복원' }))
    expect(await screen.findByText(/합쳤습니다. 새로 들어온 항목: 풀이 기록 1개/)).toBeInTheDocument()
    expect((await storage.listAttempts()).map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('복원(덮어쓰기): 확인 창을 거쳐 지금 데이터를 바꾼다', async () => {
    await open('/settings', async (s) => {
      await s.addAttempt(attempt('old', 'S1-05-0001', '2026-10-01T00:00:00.000Z'))
      await s.setMeta('examDate', '2026-11-20')
    })
    await screen.findByText('아직 백업한 적이 없습니다.')
    pickFile(fileOf(dump({ attempts: [attempt('new', 'S1-05-0001', '2026-10-02T00:00:00.000Z')] })))
    await screen.findByText(/backup.json:/)
    fireEvent.click(screen.getByRole('radio', { name: '덮어쓰기' }))
    fireEvent.click(screen.getByRole('button', { name: '덮어써서 복원' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('지금 데이터를 덮어쓸까요?')
    fireEvent.click(within(dialog).getByRole('button', { name: '덮어쓰기' }))

    expect(await screen.findByText(/백업 파일로 덮어썼습니다/)).toBeInTheDocument()
    expect((await storage.listAttempts()).map((a) => a.id)).toEqual(['new'])
    expect(await storage.getMeta('examDate')).toBeUndefined()
    // 마지막 백업 = 그 파일을 만든 시각
    expect(await storage.getMeta(LAST_BACKUP_KEY)).toBe('2026-10-20T00:00:00.000Z')
  })

  it('백업 파일이 아니면 이유를 알려 주고 복원 버튼은 잠긴다', async () => {
    await open('/settings')
    await screen.findByText('아직 백업한 적이 없습니다.')
    pickFile(new File(['[1]'], 'q.json'))
    expect(await screen.findByRole('alert')).toHaveTextContent('q.json: 이 앱의 백업 파일이 아닙니다')
    expect(screen.getByRole('button', { name: '합쳐서 복원' })).toBeDisabled()
  })
})

describe('T7-4 홈 백업 권장 배너', () => {
  const recent = () => new Date(Date.now() - 2 * 86_400_000).toISOString()
  const old = () => new Date(Date.now() - 10 * 86_400_000).toISOString()

  it('첫 기록 후 7일이 지나도록 백업하지 않았으면 배너, 누르면 설정으로', async () => {
    await open('/', async (s) => {
      await s.addAttempt(attempt('a1', 'S1-05-0001', old()))
    })
    const banner = await screen.findByRole('complementary', { name: '백업 권장' })
    expect(banner).toHaveTextContent('기록을 시작한 지 10일이 지났는데 아직 백업한 적이 없습니다.')
    fireEvent.click(within(banner).getByRole('button', { name: '설정에서 백업하기' }))
    expect(await screen.findByRole('heading', { name: '설정', level: 1 })).toBeInTheDocument()
  })

  it('마지막 백업이 오래됐으면 날 수를, 최근이면 배너 없음', async () => {
    await open('/', async (s) => {
      await s.addAttempt(attempt('a1', 'S1-05-0001', old()))
      await s.setMeta(LAST_BACKUP_KEY, old())
    })
    expect(await screen.findByRole('complementary', { name: '백업 권장' })).toHaveTextContent('마지막 백업 후 10일이 지났습니다.')
  })

  it('최근에 백업했으면 배너가 없다', async () => {
    await open('/', async (s) => {
      await s.addAttempt(attempt('a1', 'S1-05-0001', old()))
      await s.setMeta(LAST_BACKUP_KEY, recent())
    })
    await screen.findByRole('heading', { name: '시험 D-day' })
    expect(screen.queryByRole('complementary', { name: '백업 권장' })).toBeNull()
  })
})
