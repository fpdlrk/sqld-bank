/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import type { Attempt, Session, UserQuestion } from '../src/domain'
import {
  SCHEMA_VERSION,
  createIndexedDbStorage,
  getStorage,
  setStorage,
  type StorageAdapter,
} from '../src/storage'

// 테스트마다 새 이름의 DB를 써서 서로 영향을 주지 않게 한다 (fake-indexeddb는 tests/setup.ts에서 켬)
let dbCount = 0
let storage: StorageAdapter
beforeEach(() => {
  storage = createIndexedDbStorage(`test-db-${++dbCount}`)
})

const attempt = (id: string, over: Partial<Attempt> = {}): Attempt => ({
  id,
  questionRef: 'S1-05-0001',
  sessionId: 'sess-1',
  mode: 'practice',
  chosen: 2,
  correct: true,
  elapsedSec: 30,
  at: '2026-11-03T10:00:00.000Z',
  ...over,
})

const session = (id: string, over: Partial<Session> = {}): Session => ({
  id,
  mode: 'practice',
  startedAt: '2026-11-03T10:00:00.000Z',
  finishedAt: null,
  questionRefs: ['S1-05-0001', 'TP01#123'],
  score: null,
  subjectScores: null,
  passed: null,
  ...over,
})

const base = BUILT_IN_QUESTIONS.find((q) => q.id === 'S1-05-0001')!
const userQuestion: UserQuestion = {
  ...base,
  id: 'U-S1-05-0001',
  source: 'user',
  createdAt: '2026-11-03T10:00:00.000Z',
  updatedAt: '2026-11-03T10:00:00.000Z',
}

describe('T2-6 풀이 기록 (attempts)', () => {
  it('추가하고 회차·문제별로 시간순 조회', async () => {
    await storage.addAttempt(attempt('a2', { at: '2026-11-03T10:05:00.000Z' }))
    await storage.addAttempt(attempt('a1'))
    await storage.addAttempt(attempt('a3', { sessionId: 'sess-2', questionRef: 'S1-04-0001', at: '2026-11-03T10:09:00.000Z' }))

    expect((await storage.listAttempts()).map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
    expect((await storage.listAttempts({ sessionId: 'sess-1' })).map((a) => a.id)).toEqual(['a1', 'a2'])
    expect((await storage.listAttempts({ questionRef: 'S1-04-0001' })).map((a) => a.id)).toEqual(['a3'])
    expect(await storage.listAttempts({ sessionId: 'sess-2', questionRef: 'S1-05-0001' })).toEqual([])
  })

  it('같은 id를 두 번 추가하면 실패한다 (기록이 몰래 덮어써지지 않게)', async () => {
    await storage.addAttempt(attempt('a1'))
    await expect(storage.addAttempt(attempt('a1'))).rejects.toThrow()
  })

  it('안 푼 문항(chosen null)도 저장된다', async () => {
    await storage.addAttempt(attempt('a1', { chosen: null, correct: false }))
    expect((await storage.listAttempts())[0]?.chosen).toBeNull()
  })

  it('회차의 기록만 지운다', async () => {
    await storage.addAttempt(attempt('a1'))
    await storage.addAttempt(attempt('a2', { sessionId: 'sess-2' }))
    await storage.deleteAttemptsOfSession('sess-1')
    expect((await storage.listAttempts()).map((a) => a.id)).toEqual(['a2'])
  })
})

describe('T2-6 회차 (sessions)', () => {
  it('저장·조회·덮어쓰기 (진행 상태 포함)', async () => {
    await storage.putSession(session('s1'))
    await storage.putSession(
      session('s1', {
        progress: { currentIndex: 1, answers: { 'S1-05-0001': 3 }, flagged: [], choiceOrders: { 'TP01#123': [4, 3, 2, 1] } },
      }),
    )
    const saved = await storage.getSession('s1')
    expect(saved?.progress?.answers['S1-05-0001']).toBe(3)
    expect(saved?.progress?.choiceOrders['TP01#123']).toEqual([4, 3, 2, 1])
    expect(await storage.getSession('없음')).toBeUndefined()
  })

  it('최근 시작 순으로, 방식·진행 여부로 거른다', async () => {
    await storage.putSession(session('old', { startedAt: '2026-11-01T00:00:00.000Z', finishedAt: '2026-11-01T01:00:00.000Z' }))
    await storage.putSession(session('exam', { mode: 'exam', startedAt: '2026-11-02T00:00:00.000Z' }))
    await storage.putSession(session('new', { startedAt: '2026-11-03T00:00:00.000Z' }))

    expect((await storage.listSessions()).map((s) => s.id)).toEqual(['new', 'exam', 'old'])
    expect((await storage.listSessions({ mode: 'practice' })).map((s) => s.id)).toEqual(['new', 'old'])
    expect((await storage.listSessions({ unfinished: true })).map((s) => s.id)).toEqual(['new', 'exam'])
    expect((await storage.listSessions({ unfinished: false })).map((s) => s.id)).toEqual(['old'])
  })

  it('삭제', async () => {
    await storage.putSession(session('s1'))
    await storage.deleteSession('s1')
    expect(await storage.getSession('s1')).toBeUndefined()
  })
})

describe('T2-6 오답노트 (notes)', () => {
  it('문제 하나당 1건 — 다시 저장하면 덮어쓴다', async () => {
    const note = { questionRef: 'S1-05-0001', bookmarked: false, memo: '', mastered: false, updatedAt: '2026-11-03T10:00:00.000Z' }
    await storage.putNote(note)
    await storage.putNote({ ...note, memo: 'GROUP BY 뒤 컬럼 주의', bookmarked: true })
    expect(await storage.listNotes()).toHaveLength(1)
    expect((await storage.getNote('S1-05-0001'))?.memo).toBe('GROUP BY 뒤 컬럼 주의')
    await storage.deleteNote('S1-05-0001')
    expect(await storage.listNotes()).toEqual([])
  })
})

describe('T2-6 직접 추가 문제 (userQuestions)', () => {
  it('저장·조회·수정·삭제, 본문·표가 그대로 보존된다', async () => {
    await storage.putUserQuestion(userQuestion)
    expect(await storage.getUserQuestion('U-S1-05-0001')).toEqual(userQuestion)

    await storage.putUserQuestion({ ...userQuestion, difficulty: 3 })
    const list = await storage.listUserQuestions()
    expect(list).toHaveLength(1)
    expect(list[0]?.difficulty).toBe(3)

    await storage.deleteUserQuestion('U-S1-05-0001')
    expect(await storage.listUserQuestions()).toEqual([])
  })
})

describe('T2-6 설정 (meta)', () => {
  it('여러 모양의 값을 저장·삭제', async () => {
    await storage.setMeta('examDate', '2026-12-05')
    await storage.setMeta('settings', { shuffle: true, count: 20 })
    expect(await storage.getMeta<string>('examDate')).toBe('2026-12-05')
    expect(await storage.getMeta('settings')).toEqual({ shuffle: true, count: 20 })
    expect(await storage.getMeta('없음')).toBeUndefined()
    await storage.deleteMeta('examDate')
    expect(await storage.getMeta('examDate')).toBeUndefined()
  })
})

describe('T2-6 전체 내보내기·가져오기·초기화', () => {
  async function fill(s: StorageAdapter) {
    await s.addAttempt(attempt('a1'))
    await s.putSession(session('s1'))
    await s.putNote({ questionRef: 'S1-05-0001', bookmarked: true, memo: '메모', mastered: false, updatedAt: '2026-11-03T10:00:00.000Z' })
    await s.putUserQuestion(userQuestion)
    await s.setMeta('theme', 'dark')
  }

  it('내보낸 묶음을 다른 DB에 가져오면 똑같아진다', async () => {
    await fill(storage)
    const dump = await storage.exportAll()
    expect(dump.schemaVersion).toBe(SCHEMA_VERSION)
    expect(dump.attempts).toHaveLength(1)

    const other = createIndexedDbStorage(`test-db-${++dbCount}`)
    await other.setMeta('지워질값', 1) // 가져오기 전 데이터는 사라진다
    await other.importAll(JSON.parse(JSON.stringify(dump)))
    const again = await other.exportAll()
    expect({ ...again, exportedAt: '' }).toEqual({ ...dump, exportedAt: '' })
  })

  it('버전이 더 새롭거나 잘못된 묶음은 거부하고, 기존 데이터는 그대로 둔다', async () => {
    await fill(storage)
    const dump = await storage.exportAll()
    await expect(storage.importAll({ ...dump, schemaVersion: SCHEMA_VERSION + 1 })).rejects.toThrow('더 새로운 버전')
    await expect(storage.importAll({ ...dump, schemaVersion: 0 })).rejects.toThrow('버전 정보')
    expect(await storage.getMeta('theme')).toBe('dark')
  })

  it('가져오기 도중 실패하면 원래 데이터가 그대로 남는다', async () => {
    await fill(storage)
    const dump = await storage.exportAll()
    // 같은 id 기록 2건 → bulkAdd 실패 → 트랜잭션 전체 취소
    const broken = { ...dump, attempts: [attempt('x'), attempt('x')] }
    await expect(storage.importAll(broken)).rejects.toThrow()
    expect((await storage.listAttempts()).map((a) => a.id)).toEqual(['a1'])
    expect(await storage.getMeta('theme')).toBe('dark')
  })

  it('초기화하면 모든 테이블이 빈다', async () => {
    await fill(storage)
    await storage.clearAll()
    const dump = await storage.exportAll()
    expect([dump.attempts, dump.sessions, dump.notes, dump.userQuestions, dump.meta]).toEqual([[], [], [], [], []])
  })
})

describe('T2-6 공용 저장소', () => {
  it('getStorage는 같은 객체를 돌려주고, setStorage로 바꿔 끼울 수 있다', () => {
    const a = getStorage()
    expect(getStorage()).toBe(a)
    setStorage(storage)
    expect(getStorage()).toBe(storage)
    setStorage(undefined)
  })
})

describe('T2-6 Dexie 직접 사용 금지', () => {
  // storage/ 밖의 앱 코드에서 dexie를 import하면 실패
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name)
      return statSync(p).isDirectory() ? walk(p) : [p]
    })
  }

  it('src/storage 외의 파일은 dexie를 import하지 않는다', () => {
    const src = join(process.cwd(), 'src')
    const offenders = walk(src)
      .filter((p) => /\.(ts|tsx)$/.test(p) && !p.startsWith(join(src, 'storage')))
      .filter((p) => /from\s+['"]dexie['"]|import\(\s*['"]dexie['"]\s*\)/.test(readFileSync(p, 'utf8')))
    expect(offenders).toEqual([])
  })
})
