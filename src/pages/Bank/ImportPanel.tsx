import { useMemo, useState } from 'react'
import { Button, Card } from '../../components'
// 가져오기 검사는 zod를 쓰므로 이 화면(따로 떼어 불러옴)에서만 직접 import
import { parseQuestionsFile, planImport, type ConflictMode } from '../../domain/questionImport'
import { getStorage } from '../../storage'
import { SingleChips } from '../Practice/OptionChips'
import { fieldLabel } from './QuestionEditorPage'
import { readFileText } from './fileIO'
import styles from './Bank.module.css'

const MODES: { value: ConflictMode; label: string }[] = [
  { value: 'renumber', label: '새 번호로 추가' },
  { value: 'overwrite', label: '덮어쓰기' },
  { value: 'skip', label: '건너뛰기' },
]

interface Props {
  existingIds: readonly string[]
  /** 가져오기 끝 — 가져온 문제 수 */
  onDone: (count: number) => void
  onCancel: () => void
}

/** 문제 JSON 가져오기 (T7-3) — 파일 고르기 → 검사 결과 미리보기 → 가져오기 */
export function ImportPanel({ existingIds, onDone, onCancel }: Props) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [items, setItems] = useState<unknown[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [mode, setMode] = useState<ConflictMode>('renumber')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const plan = useMemo(() => (items ? planImport(items, existingIds, mode) : null), [items, existingIds, mode])

  async function pick(file: File | undefined) {
    setItems(null)
    setParseError(null)
    if (!file) return
    setFileName(file.name)
    const parsed = parseQuestionsFile(await readFileText(file))
    if (parsed.ok) setItems(parsed.items)
    else setParseError(parsed.message)
  }

  async function save() {
    if (!plan) return
    setSaving(true)
    try {
      const storage = getStorage()
      for (const q of plan.ready) await storage.putUserQuestion(q)
      onDone(plan.ready.length)
    } catch {
      setSaving(false)
      setSaveError(true)
    }
  }

  return (
    <Card title="문제 JSON 가져오기">
      <label className={styles.search}>
        <span className={styles.searchLabel}>JSON 파일 (이 앱에서 내보낸 파일 또는 문제 배열)</span>
        <input type="file" accept=".json,application/json" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>

      {parseError && (
        <p className={styles.importError} role="alert">
          {fileName}: {parseError}
        </p>
      )}

      {plan && (
        <>
          <p aria-live="polite">
            {fileName}: 문제 {plan.total}개 중 <strong>{plan.ready.length}개</strong>를 가져옵니다
            {plan.invalid.length > 0 && ` · 오류 ${plan.invalid.length}개는 건너뜀`}
            {plan.conflicts > 0 && ` · ID 겹침 ${plan.conflicts}개`}
            {plan.renumbered > 0 && ` · 새 번호 ${plan.renumbered}개`}
            {plan.overwritten > 0 && ` · 덮어쓰기 ${plan.overwritten}개`}
          </p>

          {plan.conflicts > 0 && (
            <div className={styles.search}>
              <span className={styles.searchLabel}>이미 있는 직접 추가 문제와 ID가 겹치면</span>
              <SingleChips label="ID가 겹칠 때" options={MODES} value={mode} onChange={setMode} />
            </div>
          )}

          {plan.invalid.length > 0 && (
            <details className={styles.invalid} open={plan.invalid.length <= 5}>
              <summary>오류가 있는 문제 {plan.invalid.length}개 (가져오지 않음)</summary>
              <ul>
                {plan.invalid.map((it) => (
                  <li key={it.index}>
                    {it.index}번째 문제{it.id ? `(${it.id})` : ''} —{' '}
                    {it.problems
                      .slice(0, 3)
                      .map((p) => `${fieldLabel(p.path)}: ${p.message}`)
                      .join(' / ')}
                    {it.problems.length > 3 && ` 외 ${it.problems.length - 3}개`}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {saveError && (
            <p className={styles.importError} role="alert">
              저장하지 못했습니다.
            </p>
          )}
        </>
      )}

      <div className={styles.rowActions}>
        <Button disabled={!plan || plan.ready.length === 0 || saving} onClick={() => void save()}>
          {saving ? '가져오는 중…' : plan ? `${plan.ready.length}문제 가져오기` : '가져오기'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          닫기
        </Button>
      </div>
    </Card>
  )
}
