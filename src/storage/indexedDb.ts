/**
 * IndexedDB 구현 (T2-6) — Dexie 라이브러리 사용
 *
 * Dexie는 이 파일에서만 import한다. 화면 코드는 StorageAdapter 인터페이스만 쓴다.
 *
 * 스키마 버전 관리:
 *   구조를 바꿀 때는 아래 version(1)을 고치지 말고 version(2)를 "추가"한다.
 *   예) db.version(2).stores({ attempts: 'id, sessionId, questionRef, at, mode' })
 *        .upgrade(tx => tx.table('attempts').toCollection().modify(a => { ... }))
 *   Dexie가 사용자 브라우저에 저장된 옛 버전을 열 때 upgrade를 순서대로 실행해 준다.
 *   그리고 StorageAdapter.ts의 SCHEMA_VERSION도 같은 숫자로 올린다.
 */
import { Dexie, type Table } from 'dexie'
import type { Attempt, MetaEntry, Note, Session, UserQuestion } from '../domain'
import {
  SCHEMA_VERSION,
  type AttemptQuery,
  type SessionQuery,
  type StorageAdapter,
  type StorageDump,
} from './StorageAdapter'

/** 앱이 쓰는 IndexedDB 데이터베이스 이름 */
export const DEFAULT_DB_NAME = 'sqld-bank'

type SqldDexie = Dexie & {
  attempts: Table<Attempt, string>
  sessions: Table<Session, string>
  notes: Table<Note, string>
  userQuestions: Table<UserQuestion, string>
  meta: Table<MetaEntry, string>
}

function openDexie(name: string): SqldDexie {
  const db = new Dexie(name) as SqldDexie
  // 첫 칸 = 기본 키, 나머지 = 검색용 인덱스. 인덱스가 아닌 필드도 저장은 모두 된다.
  // (true/false 값은 IndexedDB 인덱스로 쓸 수 없어서 finishedAt·mastered 등은 읽은 뒤 거른다)
  db.version(1).stores({
    attempts: 'id, sessionId, questionRef, at',
    sessions: 'id, mode, startedAt',
    notes: 'questionRef',
    userQuestions: 'id, chapter',
    meta: 'key',
  })
  return db
}

/** 시각(ISO 문자열) 오래된 순 정렬 — ISO 문자열은 글자 순서가 곧 시간 순서 */
const byAt = (a: Attempt, b: Attempt) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)

export function createIndexedDbStorage(dbName: string = DEFAULT_DB_NAME): StorageAdapter {
  const db = openDexie(dbName)
  const allTables = () => [db.attempts, db.sessions, db.notes, db.userQuestions, db.meta]

  return {
    // ── attempts
    async addAttempt(attempt) {
      await db.attempts.add(attempt)
    },
    async listAttempts(query: AttemptQuery = {}) {
      const { sessionId, questionRef } = query
      let rows: Attempt[]
      if (sessionId !== undefined) {
        rows = await db.attempts.where('sessionId').equals(sessionId).toArray()
      } else if (questionRef !== undefined) {
        rows = await db.attempts.where('questionRef').equals(questionRef).toArray()
      } else {
        rows = await db.attempts.toArray()
      }
      if (sessionId !== undefined && questionRef !== undefined) {
        rows = rows.filter((a) => a.questionRef === questionRef)
      }
      return rows.sort(byAt)
    },
    async deleteAttemptsOfSession(sessionId) {
      await db.attempts.where('sessionId').equals(sessionId).delete()
    },

    // ── sessions
    async putSession(session) {
      await db.sessions.put(session)
    },
    getSession(id) {
      return db.sessions.get(id)
    },
    async listSessions(query: SessionQuery = {}) {
      const { mode, unfinished } = query
      const rows = await db.sessions.orderBy('startedAt').reverse().toArray()
      return rows.filter(
        (s) =>
          (mode === undefined || s.mode === mode) &&
          (unfinished === undefined || (s.finishedAt === null) === unfinished),
      )
    },
    async deleteSession(id) {
      await db.sessions.delete(id)
    },

    // ── notes
    async putNote(note) {
      await db.notes.put(note)
    },
    getNote(questionRef) {
      return db.notes.get(questionRef)
    },
    listNotes() {
      return db.notes.toArray()
    },
    async deleteNote(questionRef) {
      await db.notes.delete(questionRef)
    },

    // ── userQuestions (기본 키 순 = ID 순)
    async putUserQuestion(question) {
      await db.userQuestions.put(question)
    },
    getUserQuestion(id) {
      return db.userQuestions.get(id)
    },
    listUserQuestions() {
      return db.userQuestions.toArray()
    },
    async deleteUserQuestion(id) {
      await db.userQuestions.delete(id)
    },

    // ── meta
    async getMeta<T>(key: string) {
      const entry = await db.meta.get(key)
      return entry?.value as T | undefined
    },
    async setMeta<T>(key: string, value: T) {
      await db.meta.put({ key, value })
    },
    async deleteMeta(key) {
      await db.meta.delete(key)
    },

    // ── 전체
    async exportAll() {
      // 한 트랜잭션으로 읽어야 도중에 기록이 추가돼도 테이블끼리 어긋나지 않는다
      return db.transaction('r', allTables(), async () => ({
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        attempts: await db.attempts.toArray(),
        sessions: await db.sessions.toArray(),
        notes: await db.notes.toArray(),
        userQuestions: await db.userQuestions.toArray(),
        meta: await db.meta.toArray(),
      }))
    },
    async importAll(dump: StorageDump) {
      if (!Number.isInteger(dump.schemaVersion) || dump.schemaVersion < 1) {
        throw new Error('백업 파일의 버전 정보가 올바르지 않습니다.')
      }
      if (dump.schemaVersion > SCHEMA_VERSION) {
        throw new Error(
          `더 새로운 버전(${dump.schemaVersion})의 백업 파일입니다. 앱을 새로고침해 최신 버전으로 연 뒤 다시 시도하세요.`,
        )
      }
      // 트랜잭션 안에서 하나라도 실패하면 지운 것까지 모두 원래대로 돌아간다
      await db.transaction('rw', allTables(), async () => {
        await Promise.all(allTables().map((t) => t.clear()))
        await db.attempts.bulkAdd(dump.attempts)
        await db.sessions.bulkAdd(dump.sessions)
        await db.notes.bulkAdd(dump.notes)
        await db.userQuestions.bulkAdd(dump.userQuestions)
        await db.meta.bulkAdd(dump.meta)
      })
    },
    async clearAll() {
      await db.transaction('rw', allTables(), async () => {
        await Promise.all(allTables().map((t) => t.clear()))
      })
    },
  }
}
