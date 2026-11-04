/**
 * 전체 백업/복원 (T7-4)
 *
 * 백업 파일 = 저장소 전체(attempts·sessions·notes·userQuestions·meta) + 형식 이름.
 * 복원 방식
 * - 덮어쓰기: 지금 기기의 데이터를 모두 지우고 백업 파일 내용으로 바꾼다.
 * - 합치기: 두 데이터를 모은다. 같은 항목이면 아래 규칙으로 하나만 남긴다.
 *   · 풀이 기록: id가 같으면 같은 기록 → 하나만
 *   · 회차: id가 같으면 끝난 쪽 → 둘 다 진행 중이면 더 많이 푼 쪽
 *   · 오답노트·직접 추가 문제: 마지막으로 바뀐(updatedAt) 쪽
 *   · 직접 추가 문제인데 ID만 같고 처음 만든 날이 다르면 → 다른 기기에서 따로 만든 다른 문제.
 *     백업 쪽 문제에 새 번호를 붙이고, 그 문제의 풀이 기록·오답노트·회차도 새 번호로 바꾼다.
 *   · 설정(meta): 지금 기기 값 우선, 없는 항목만 추가
 */
import { nextUserQuestionId } from './questionDraft'
import type { Attempt, MetaEntry, Note, QuestionRef, Session, UserQuestion } from './types'

/** 저장소 전체 묶음 (storage의 exportAll/importAll과 같은 모양) */
export interface DataDump {
  schemaVersion: number
  exportedAt: string
  attempts: Attempt[]
  sessions: Session[]
  notes: Note[]
  userQuestions: UserQuestion[]
  meta: MetaEntry[]
}

export const BACKUP_FILE_FORMAT = 'sqld-bank/backup'
/** 마지막 백업 시각을 적어 두는 meta 키 */
export const LAST_BACKUP_KEY = 'lastBackupAt'
/** 마지막 백업 후 며칠이 지나면 홈에서 백업을 권할지 */
export const BACKUP_REMIND_DAYS = 7

export type BackupFile = DataDump & { format: typeof BACKUP_FILE_FORMAT }
export type RestoreMode = 'merge' | 'overwrite'

export function buildBackupFile(dump: DataDump): BackupFile {
  return { format: BACKUP_FILE_FORMAT, ...dump }
}

export type BackupParse = { ok: true; dump: DataDump } | { ok: false; message: string }

const TABLES = [
  ['attempts', 'id'],
  ['sessions', 'id'],
  ['notes', 'questionRef'],
  ['userQuestions', 'id'],
  ['meta', 'key'],
] as const

const TABLE_LABELS: Record<(typeof TABLES)[number][0], string> = {
  attempts: '풀이 기록',
  sessions: '회차',
  notes: '오답노트',
  userQuestions: '직접 추가 문제',
  meta: '설정',
}

/**
 * 파일 글자 → 백업 묶음. 모양만 검사한다 (항목마다 구분 키가 있는지).
 * @param maxSchemaVersion 이 앱이 읽을 수 있는 가장 높은 데이터 버전
 */
export function parseBackupFile(text: string, maxSchemaVersion: number): BackupParse {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, message: 'JSON 형식이 아닙니다. 파일 내용을 확인해 주세요.' }
  }
  if (typeof data !== 'object' || data === null || (data as { format?: unknown }).format !== BACKUP_FILE_FORMAT) {
    return { ok: false, message: '이 앱의 백업 파일이 아닙니다. 설정 화면에서 내려받은 백업 파일을 골라 주세요.' }
  }
  const obj = data as Record<string, unknown>
  const version = obj.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, message: '백업 파일의 버전 정보가 올바르지 않습니다.' }
  }
  if (version > maxSchemaVersion) {
    return {
      ok: false,
      message: `더 새로운 버전(${version})의 백업 파일입니다. 앱을 새로고침해 최신 버전으로 연 뒤 다시 시도하세요.`,
    }
  }
  for (const [table, key] of TABLES) {
    const rows = obj[table]
    const bad =
      !Array.isArray(rows) ||
      rows.some((r) => typeof r !== 'object' || r === null || typeof (r as Record<string, unknown>)[key] !== 'string')
    if (bad) return { ok: false, message: `백업 파일의 ${TABLE_LABELS[table]} 부분이 손상되었습니다.` }
  }
  return {
    ok: true,
    dump: {
      schemaVersion: version,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
      attempts: obj.attempts as Attempt[],
      sessions: obj.sessions as Session[],
      notes: obj.notes as Note[],
      userQuestions: obj.userQuestions as UserQuestion[],
      meta: obj.meta as MetaEntry[],
    },
  }
}

/** 화면에 보여 줄 항목 수 */
export interface DumpCounts {
  attempts: number
  /** 끝낸 회차 (진행 중 제외) */
  sessions: number
  notes: number
  userQuestions: number
}

export function countDump(dump: DataDump): DumpCounts {
  return {
    attempts: dump.attempts.length,
    sessions: dump.sessions.filter((s) => s.finishedAt !== null).length,
    notes: dump.notes.length,
    userQuestions: dump.userQuestions.length,
  }
}

export interface DumpMergeResult {
  dump: DataDump
  /** 새로 들어온 항목 수 (이미 있던 것 제외) */
  added: DumpCounts
  /** ID가 겹쳐 새 번호를 붙인 직접 추가 문제: [원래 ID, 새 ID] */
  renamed: [string, string][]
}

/** 합치기 — current(지금 기기)에 incoming(백업 파일)을 더한다 */
export function mergeDumps(current: DataDump, incoming: DataDump): DumpMergeResult {
  // 1) 직접 추가 문제 — ID가 같아도 다른 문제면 백업 쪽에 새 번호
  const questions = new Map(current.userQuestions.map((q) => [q.id, q]))
  const used = new Set([...questions.keys(), ...incoming.userQuestions.map((q) => q.id)])
  const rename = new Map<string, string>()
  let addedQuestions = 0
  for (const q of incoming.userQuestions) {
    const mine = questions.get(q.id)
    if (!mine) {
      questions.set(q.id, q)
      addedQuestions++
    } else if (mine.createdAt !== q.createdAt) {
      const id = nextUserQuestionId([...used], q.chapter)
      used.add(id)
      rename.set(q.id, id)
      questions.set(id, { ...q, id })
      addedQuestions++
    } else if (q.updatedAt > mine.updatedAt) {
      questions.set(q.id, q)
    }
  }
  const ref = (r: QuestionRef): QuestionRef => rename.get(r) ?? r

  // 2) 풀이 기록 — id가 같으면 같은 기록
  const attempts = new Map(current.attempts.map((a) => [a.id, a]))
  let addedAttempts = 0
  for (const a of incoming.attempts) {
    if (attempts.has(a.id)) continue
    attempts.set(a.id, { ...a, questionRef: ref(a.questionRef) })
    addedAttempts++
  }

  // 3) 회차 — 끝난 쪽, 둘 다 진행 중이면 더 많이 푼 쪽
  const answered = (s: Session) => Object.keys(s.progress?.answers ?? {}).length
  const sessions = new Map(current.sessions.map((s) => [s.id, s]))
  let addedSessions = 0
  for (const raw of incoming.sessions) {
    const s = rename.size > 0 ? { ...raw, questionRefs: raw.questionRefs.map(ref) } : raw
    const mine = sessions.get(s.id)
    if (!mine) {
      sessions.set(s.id, s)
      if (s.finishedAt !== null) addedSessions++
    } else if (mine.finishedAt === null && (s.finishedAt !== null || answered(s) > answered(mine))) {
      sessions.set(s.id, s)
      if (s.finishedAt !== null) addedSessions++
    }
  }

  // 4) 오답노트 — 마지막으로 바뀐 쪽
  const notes = new Map(current.notes.map((n) => [n.questionRef, n]))
  let addedNotes = 0
  for (const raw of incoming.notes) {
    const n = { ...raw, questionRef: ref(raw.questionRef) }
    const mine = notes.get(n.questionRef)
    if (!mine) addedNotes++
    if (!mine || n.updatedAt > mine.updatedAt) notes.set(n.questionRef, n)
  }

  // 5) 설정 — 지금 기기 값 우선
  const meta = new Map(current.meta.map((m) => [m.key, m]))
  for (const m of incoming.meta) if (!meta.has(m.key)) meta.set(m.key, m)

  return {
    dump: {
      schemaVersion: Math.max(current.schemaVersion, incoming.schemaVersion),
      exportedAt: current.exportedAt,
      attempts: [...attempts.values()],
      sessions: [...sessions.values()],
      notes: [...notes.values()],
      userQuestions: [...questions.values()],
      meta: [...meta.values()],
    },
    added: { attempts: addedAttempts, sessions: addedSessions, notes: addedNotes, userQuestions: addedQuestions },
    renamed: [...rename.entries()],
  }
}

/** iso 시각부터 now까지 지난 날 수 (내림) */
export function daysSince(iso: string, now: Date = new Date()): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000))
}

/**
 * 홈에서 백업을 권할지.
 * 기준 시각 = 마지막 백업, 백업한 적이 없으면 가장 오래된 풀이 기록.
 * 기록이 없으면 권하지 않는다.
 * @returns 권해야 하면 지난 날 수, 아니면 null
 */
export function backupReminder(
  lastBackupAt: string | undefined,
  oldestRecordAt: string | undefined,
  now: Date = new Date(),
): number | null {
  if (oldestRecordAt === undefined) return null
  const days = daysSince(lastBackupAt ?? oldestRecordAt, now)
  return days >= BACKUP_REMIND_DAYS ? days : null
}
