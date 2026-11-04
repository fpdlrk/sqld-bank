import { useEffect, useState } from 'react'
import { Button, Card, Modal } from '../../components'
import {
  countDump,
  daysSince,
  fileDate,
  parseBackupFile,
  type DataDump,
  type DumpCounts,
  type RestoreMode,
} from '../../domain'
import { SCHEMA_VERSION } from '../../storage'
import { downloadJson, readFileText } from '../Bank/fileIO'
import { SingleChips } from '../Practice/OptionChips'
import { createBackup, loadBackupInfo, restoreBackup, type BackupInfo } from './backupData'
import styles from './Settings.module.css'

const MODES: { value: RestoreMode; label: string }[] = [
  { value: 'merge', label: '합치기' },
  { value: 'overwrite', label: '덮어쓰기' },
]

/** "2026-11-04 09:05" (이 기기 시간대) */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '알 수 없음'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** "풀이 기록 120개 · 끝낸 회차 15개 · 오답노트 8개 · 직접 추가 문제 3개" */
export function countsText(c: DumpCounts): string {
  return `풀이 기록 ${c.attempts}개 · 끝낸 회차 ${c.sessions}개 · 오답노트 ${c.notes}개 · 직접 추가 문제 ${c.userQuestions}개`
}

function lastBackupText(iso: string | undefined): string {
  if (!iso) return '아직 백업한 적이 없습니다.'
  const days = daysSince(iso)
  return `마지막 백업: ${formatDateTime(iso)} (${days === 0 ? '오늘' : `${days}일 전`})`
}

/** 전체 백업/복원 (T7-4) */
export function BackupSection() {
  const [info, setInfo] = useState<BackupInfo | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 복원
  const [fileName, setFileName] = useState<string | null>(null)
  const [dump, setDump] = useState<DataDump | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  // 같은 파일을 다시 고를 수 있게 복원 뒤 입력 칸을 새로 만든다
  const [inputKey, setInputKey] = useState(0)

  useEffect(() => {
    let alive = true
    loadBackupInfo()
      .then((i) => alive && setInfo(i))
      .catch(() => alive && setError('저장된 데이터를 읽지 못했습니다.'))
    return () => {
      alive = false
    }
  }, [])

  async function backup() {
    setError(null)
    try {
      const file = await createBackup()
      downloadJson(`sqld-bank-백업-${fileDate()}.json`, file)
      setInfo(await loadBackupInfo())
      setNotice('백업 파일을 내려받았습니다. 클라우드 드라이브 등 브라우저 밖에 보관해 두세요.')
    } catch {
      setError('백업 파일을 만들지 못했습니다.')
    }
  }

  async function pick(file: File | undefined) {
    setDump(null)
    setParseError(null)
    setNotice(null)
    if (!file) return
    setFileName(file.name)
    const parsed = parseBackupFile(await readFileText(file), SCHEMA_VERSION)
    if (parsed.ok) setDump(parsed.dump)
    else setParseError(parsed.message)
  }

  async function restore() {
    if (!dump) return
    setConfirming(false)
    setBusy(true)
    setError(null)
    try {
      const out = await restoreBackup(dump, mode)
      setNotice(
        out.mode === 'overwrite'
          ? `백업 파일로 덮어썼습니다 — ${countsText(out.counts)}`
          : `합쳤습니다. 새로 들어온 항목: ${countsText(out.counts)}` +
              (out.renamed.length > 0
                ? ` (ID가 겹친 직접 추가 문제 ${out.renamed.length}개는 새 번호로 바꿨습니다: ${out.renamed.map(([a, b]) => `${a} → ${b}`).join(', ')})`
                : ''),
      )
      setDump(null)
      setFileName(null)
      setInputKey((k) => k + 1)
      setInfo(await loadBackupInfo())
    } catch {
      setError('복원하지 못했습니다. 지금 데이터는 바뀌지 않았습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Card title="백업">
        <p className={styles.muted}>
          기록은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우거나 기기를 바꾸면 사라지므로, 백업 파일을 내려받아
          보관하세요.
        </p>
        <p>{info ? lastBackupText(info.lastBackupAt) : '불러오는 중…'}</p>
        {info && <p className={styles.muted}>지금 데이터: {countsText(info.counts)}</p>}
        <div className={styles.actions}>
          <Button onClick={() => void backup()} disabled={!info}>
            백업 파일 내려받기
          </Button>
        </div>
      </Card>

      <Card title="복원">
        <label className={styles.field}>
          <span className={styles.label}>백업 파일 (설정 화면에서 내려받은 JSON)</span>
          <input key={inputKey} type="file" accept=".json,application/json" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>

        {parseError && (
          <p className={styles.error} role="alert">
            {fileName}: {parseError}
          </p>
        )}

        {dump && (
          <>
            <p aria-live="polite">
              {fileName}: {dump.exportedAt ? `${formatDateTime(dump.exportedAt)}에 만든 백업` : '백업'} — {countsText(countDump(dump))}
            </p>
            <div className={styles.field}>
              <span className={styles.label}>복원 방식</span>
              <SingleChips label="복원 방식" options={MODES} value={mode} onChange={setMode} />
              <p className={styles.muted}>
                {mode === 'merge'
                  ? '합치기: 지금 기록은 그대로 두고 백업 파일의 기록을 더합니다. 같은 기록은 하나만 남깁니다.'
                  : '덮어쓰기: 지금 이 기기의 기록·오답노트·직접 추가 문제·설정을 모두 지우고 백업 파일 내용으로 바꿉니다.'}
              </p>
            </div>
          </>
        )}

        <div className={styles.actions}>
          <Button
            variant={mode === 'overwrite' ? 'danger' : 'primary'}
            disabled={!dump || busy}
            onClick={() => (mode === 'overwrite' ? setConfirming(true) : void restore())}
          >
            {busy ? '복원하는 중…' : mode === 'overwrite' ? '덮어써서 복원' : '합쳐서 복원'}
          </Button>
        </div>
      </Card>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="지금 데이터를 덮어쓸까요?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              취소
            </Button>
            <Button variant="danger" onClick={() => void restore()}>
              덮어쓰기
            </Button>
          </>
        }
      >
        <p>이 기기의 데이터({info ? countsText(info.counts) : '…'})가 모두 지워지고 백업 파일 내용으로 바뀝니다.</p>
        <p>되돌릴 수 없으니, 필요하면 먼저 [백업 파일 내려받기]로 지금 데이터를 저장해 두세요.</p>
      </Modal>
    </>
  )
}
