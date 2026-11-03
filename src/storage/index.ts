/**
 * storage/ — 저장소 어댑터
 *
 * 화면·도메인 코드는 IndexedDB(Dexie)를 직접 부르지 않고 반드시 이 폴더의
 * 어댑터 인터페이스를 거친다. 나중에 Supabase 등으로 바꿀 때 이 폴더만 고치면 된다.
 *
 * 사용법:  const storage = getStorage();  await storage.addAttempt(...)
 */
import { createIndexedDbStorage } from './indexedDb'
import type { StorageAdapter } from './StorageAdapter'

export { SCHEMA_VERSION } from './StorageAdapter'
export type { AttemptQuery, SessionQuery, StorageAdapter, StorageDump } from './StorageAdapter'
export { createIndexedDbStorage, DEFAULT_DB_NAME } from './indexedDb'

let current: StorageAdapter | undefined

/** 앱 전체가 함께 쓰는 저장소. 처음 부를 때 만든다 */
export function getStorage(): StorageAdapter {
  current ??= createIndexedDbStorage()
  return current
}

/** 다른 저장소로 바꿔 끼운다 (테스트, Phase 10 동기화용). undefined면 기본값으로 되돌림 */
export function setStorage(adapter: StorageAdapter | undefined): void {
  current = adapter
}
