/**
 * 저장소 어댑터 인터페이스 (T2-6)
 *
 * 화면·도메인 코드는 이 인터페이스만 알고, 실제 저장 방식(IndexedDB, 나중에 Supabase)은 모른다.
 * 그래서 저장 방식을 바꿀 때 구현 파일만 새로 만들면 된다.
 *
 * 모든 함수가 Promise를 돌려주는 이유: IndexedDB·네트워크 저장소는 모두 비동기이기 때문.
 * 돌려받은 객체는 복사본이다. 고쳐도 저장되지 않으므로, 바꾸려면 다시 put 해야 한다.
 */
import type {
  Attempt,
  MetaEntry,
  Note,
  QuestionRef,
  Session,
  StudyMode,
  UserQuestion,
} from '../domain'

/** 저장 데이터 구조의 버전. 테이블·필드 구조를 바꾸면 올리고 indexedDb.ts에 변환 코드를 추가한다. */
export const SCHEMA_VERSION = 1

/** 풀이 기록 조회 조건. 비워 두면 전체 */
export interface AttemptQuery {
  sessionId?: string
  questionRef?: QuestionRef
}

/** 회차 조회 조건. 비워 두면 전체 */
export interface SessionQuery {
  mode?: StudyMode
  /** true = 진행 중(finishedAt이 null)인 회차만, false = 끝난 회차만 */
  unfinished?: boolean
}

/** 전체 데이터 묶음 — 백업 파일(T7-3)과 저장소 교체 시 옮기기에 쓴다 */
export interface StorageDump {
  schemaVersion: number
  exportedAt: string
  attempts: Attempt[]
  sessions: Session[]
  notes: Note[]
  userQuestions: UserQuestion[]
  meta: MetaEntry[]
}

export interface StorageAdapter {
  // ── 풀이 기록 (attempts) — 시각(at) 오래된 순으로 돌려준다
  addAttempt(attempt: Attempt): Promise<void>
  listAttempts(query?: AttemptQuery): Promise<Attempt[]>
  deleteAttemptsOfSession(sessionId: string): Promise<void>

  // ── 회차 (sessions) — 시작 시각 최근 순으로 돌려준다
  /** 같은 id가 있으면 덮어쓴다 (진행 상태 저장에도 사용) */
  putSession(session: Session): Promise<void>
  getSession(id: string): Promise<Session | undefined>
  listSessions(query?: SessionQuery): Promise<Session[]>
  deleteSession(id: string): Promise<void>

  // ── 오답노트 상태·메모 (notes) — 문제 하나당 1건
  putNote(note: Note): Promise<void>
  getNote(questionRef: QuestionRef): Promise<Note | undefined>
  listNotes(): Promise<Note[]>
  deleteNote(questionRef: QuestionRef): Promise<void>

  // ── 직접 추가 문제 (userQuestions) — ID 순으로 돌려준다
  putUserQuestion(question: UserQuestion): Promise<void>
  getUserQuestion(id: string): Promise<UserQuestion | undefined>
  listUserQuestions(): Promise<UserQuestion[]>
  deleteUserQuestion(id: string): Promise<void>

  // ── 설정 등 key-value (meta)
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta<T>(key: string, value: T): Promise<void>
  deleteMeta(key: string): Promise<void>

  // ── 전체
  /** 모든 테이블을 한 묶음으로 꺼낸다 */
  exportAll(): Promise<StorageDump>
  /** 기존 데이터를 모두 지우고 묶음으로 바꾼다. 중간에 실패하면 아무것도 바뀌지 않는다 */
  importAll(dump: StorageDump): Promise<void>
  /** 모든 데이터를 지운다 (설정 → 데이터 초기화) */
  clearAll(): Promise<void>
}
