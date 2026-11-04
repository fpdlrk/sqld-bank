import { useEffect, useId, useState } from 'react'
import { Button } from '../../components'
import { REPORT_KIND_LABELS, emptyNote, setReport, type QuestionRef, type QuestionReport, type ReportKind } from '../../domain'
import { getStorage, type StorageAdapter } from '../../storage'
import { SingleChips } from './OptionChips'
import styles from './ReportIssue.module.css'

const KINDS = (Object.keys(REPORT_KIND_LABELS) as ReportKind[]).map((value) => ({ value, label: REPORT_KIND_LABELS[value] }))
export const REPORT_DETAIL_MAX = 500

/**
 * "문제 오류 의심" 신고 (T7-5)
 * 버튼 → 종류·사유 입력 → 저장. 이미 신고한 문제면 신고 내용과 [고치기]·[신고 취소]를 보여 준다.
 * 저장 위치: 그 문제의 Note.report (오답노트와 같은 표 — 백업에도 함께 들어간다)
 */
export function ReportIssue({ questionRef, storage = getStorage() }: { questionRef: QuestionRef; storage?: StorageAdapter }) {
  const [report, setReportState] = useState<QuestionReport | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [kind, setKind] = useState<ReportKind>('answer')
  const [detail, setDetail] = useState('')
  const [error, setError] = useState(false)
  const detailId = useId()

  useEffect(() => {
    let alive = true
    storage
      .getNote(questionRef)
      .then((n) => alive && setReportState(n?.report))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [questionRef, storage])

  function startEdit() {
    setKind(report?.kind ?? 'answer')
    setDetail(report?.detail ?? '')
    setError(false)
    setEditing(true)
  }

  async function save(next: { kind: ReportKind; detail: string } | null) {
    try {
      // 오답노트 메모·북마크는 그대로 두고 신고만 바꾼다
      const note = setReport((await storage.getNote(questionRef)) ?? emptyNote(questionRef), next)
      await storage.putNote(note)
      setReportState(note.report)
      setEditing(false)
      setError(false)
    } catch {
      setError(true)
    }
  }

  if (editing) {
    return (
      <form
        className={styles.box}
        aria-label="문제 오류 신고"
        onSubmit={(e) => {
          e.preventDefault()
          void save({ kind, detail })
        }}
      >
        <SingleChips label="어떤 오류인가요?" options={KINDS} value={kind} onChange={setKind} />
        <label htmlFor={detailId} className={styles.label}>
          사유 (선택, {REPORT_DETAIL_MAX}자까지)
        </label>
        <textarea
          id={detailId}
          className={styles.textarea}
          rows={3}
          maxLength={REPORT_DETAIL_MAX}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="예: 3번 보기도 정답 같음 — NULL이 있는 행은 COUNT(컬럼)에서 빠지므로"
        />
        {error && (
          <p role="alert" className={styles.error}>
            저장하지 못했습니다.
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit">신고 저장</Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            취소
          </Button>
        </div>
      </form>
    )
  }

  if (report) {
    return (
      <div className={styles.box} role="note" aria-label="오류 신고함">
        <p className={styles.reported}>
          <strong>오류 신고함</strong> · {REPORT_KIND_LABELS[report.kind]}
          {report.detail && ` — ${report.detail}`}
        </p>
        {error && (
          <p role="alert" className={styles.error}>
            저장하지 못했습니다.
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={startEdit}>
            고치기
          </Button>
          <Button variant="ghost" onClick={() => void save(null)}>
            신고 취소
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.actions}>
      <Button variant="ghost" onClick={startEdit}>
        문제 오류 의심
      </Button>
    </div>
  )
}
