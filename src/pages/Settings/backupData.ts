import {
  LAST_BACKUP_KEY,
  buildBackupFile,
  countDump,
  mergeDumps,
  type BackupFile,
  type DataDump,
  type DumpCounts,
  type RestoreMode,
} from '../../domain'
import { getStorage } from '../../storage'

export interface BackupInfo {
  lastBackupAt: string | undefined
  counts: DumpCounts
}

/** 설정 화면 — 마지막 백업 시각과 지금 데이터 양 */
export async function loadBackupInfo(): Promise<BackupInfo> {
  const storage = getStorage()
  const [lastBackupAt, dump] = await Promise.all([storage.getMeta<unknown>(LAST_BACKUP_KEY), storage.exportAll()])
  return { lastBackupAt: typeof lastBackupAt === 'string' ? lastBackupAt : undefined, counts: countDump(dump) }
}

/** 백업 파일 만들기 — 마지막 백업 시각을 먼저 적어서 파일에도 들어가게 한다 */
export async function createBackup(now: Date = new Date()): Promise<BackupFile> {
  const storage = getStorage()
  await storage.setMeta(LAST_BACKUP_KEY, now.toISOString())
  return buildBackupFile(await storage.exportAll())
}

export interface RestoreOutcome {
  mode: RestoreMode
  /** 합치기: 새로 들어온 항목 수 / 덮어쓰기: 복원한 항목 수 */
  counts: DumpCounts
  renamed: [string, string][]
}

/** 복원 — 한 번에 저장하므로 중간에 실패하면 아무것도 바뀌지 않는다 */
export async function restoreBackup(dump: DataDump, mode: RestoreMode, now: Date = new Date()): Promise<RestoreOutcome> {
  const storage = getStorage()
  if (mode === 'overwrite') {
    await storage.importAll(dump)
    // 지금 데이터 = 백업 파일 내용이므로, 마지막 백업 = 그 파일을 만든 시각
    await storage.setMeta(LAST_BACKUP_KEY, dump.exportedAt || now.toISOString())
    return { mode, counts: countDump(dump), renamed: [] }
  }
  const merged = mergeDumps(await storage.exportAll(), dump)
  await storage.importAll(merged.dump)
  return { mode, counts: merged.added, renamed: merged.renamed }
}
