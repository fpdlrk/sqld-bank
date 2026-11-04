import { useState } from 'react'
import { Button } from '../../components'
import { MASTER_STREAK, setMastered, type QuestionRef } from '../../domain'
import { updateNote } from './wrongNoteData'
import styles from './WrongNote.module.css'

/** 복습 중 2회 연속 맞혔을 때 "이제 안다" 제안 (T6-3) */
export function MasterPrompt({ questionRef }: { questionRef: QuestionRef }) {
  const [state, setState] = useState<'ask' | 'done' | 'failed'>('ask')

  async function master() {
    try {
      await updateNote(questionRef, (n) => setMastered(n, true))
      setState('done')
    } catch {
      setState('failed')
    }
  }

  return (
    <div className={styles.prompt} role="status">
      {state === 'done' ? (
        <p>이제 안다로 처리했습니다. 오답노트에서 빠집니다.</p>
      ) : (
        <>
          <p>
            {MASTER_STREAK}회 연속 맞혔습니다. 이 문제를 <strong>이제 안다</strong>로 처리할까요?
          </p>
          <Button variant="secondary" onClick={() => void master()}>
            이제 안다
          </Button>
          {state === 'failed' && <p className={styles.error}>저장하지 못했습니다.</p>}
        </>
      )}
    </div>
  )
}
