import { useEffect, useId, useRef, useState } from 'react'
import styles from './WrongNote.module.css'

/** 입력을 멈추고 이만큼 지나면 저장 */
export const MEMO_SAVE_DELAY_MS = 600

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

interface Props {
  initial: string
  onSave: (memo: string) => Promise<void>
}

/**
 * 메모 자동 저장 (T6-2)
 * 입력을 멈추고 0.6초 뒤, 또는 입력 칸을 벗어날 때 저장한다. 화면을 떠날 때 남은 내용도 저장한다.
 */
export function MemoEditor({ initial, onSave }: Props) {
  const id = useId()
  const [text, setText] = useState(initial)
  const [state, setState] = useState<SaveState>('idle')
  const saved = useRef(initial)
  const latest = useRef(text)
  latest.current = text
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  async function flush() {
    const value = latest.current
    if (value === saved.current) return
    setState('saving')
    try {
      await onSaveRef.current(value)
      saved.current = value
      setState('saved')
    } catch {
      setState('failed')
    }
  }

  // 입력이 멈추면 저장
  useEffect(() => {
    if (text === saved.current) return
    const t = setTimeout(() => void flush(), MEMO_SAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [text])

  // 화면을 떠날 때 남은 내용 저장
  useEffect(() => () => void flush(), [])

  return (
    <div className={styles.memo}>
      <label htmlFor={id} className={styles.memoLabel}>
        메모
        <span className={styles.memoState} aria-live="polite">
          {state === 'saving' ? '저장 중…' : state === 'saved' ? '저장됨' : state === 'failed' ? '저장하지 못했습니다' : ''}
        </span>
      </label>
      <textarea
        id={id}
        className={styles.memoInput}
        value={text}
        rows={3}
        placeholder="헷갈린 점, 외울 내용을 적어 두세요. 자동으로 저장됩니다."
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void flush()}
      />
    </div>
  )
}
