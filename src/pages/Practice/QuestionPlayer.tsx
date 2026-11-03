import { useState, type ReactNode } from 'react'
import { AnswerFeedback, Button, QuestionView } from '../../components'
import {
  createAttempt,
  refOf,
  type AnyQuestion,
  type Attempt,
  type ChoiceNumber,
  type StudyMode,
} from '../../domain'
import { getStorage, type StorageAdapter } from '../../storage'
import styles from './QuestionPlayer.module.css'

interface Props {
  question: AnyQuestion
  sessionId: string
  mode: StudyMode
  /** 문항 번호 표시 */
  number?: number
  /** 보기 표시 순서 (원래 번호 배열) */
  order?: readonly ChoiceNumber[]
  /** 제출 직후 (저장 성공 여부와 상관없이) 불린다 */
  onSubmitted?: (attempt: Attempt) => void
  /** 채점 후 해설 아래에 보여 줄 것 (예: "다음 문제" 버튼) */
  footer?: ReactNode
  /** 테스트용 — 기본은 앱 공용 저장소 */
  storage?: StorageAdapter
  /** 테스트용 — 기본은 Date.now */
  now?: () => number
}

/**
 * 한 문제 풀기 (T3-2): 보기 고르기 → 제출 → 정답/오답 + 해설 → 풀이 기록 저장
 *
 * 문제가 바뀌면 고른 답·채점 상태·시간 측정을 처음부터 다시 시작한다.
 */
export function QuestionPlayer(props: Props) {
  // key가 바뀌면 React가 안쪽 상태를 새로 만든다 → 문제별로 상태 초기화
  return <PlayerInner key={refOf(props.question)} {...props} />
}

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

function PlayerInner({
  question,
  sessionId,
  mode,
  number,
  order,
  onSubmitted,
  footer,
  storage = getStorage(),
  now = Date.now,
}: Props) {
  // 문제를 처음 그린 시각 — 소요 시간 계산 기준
  const [shownAtMs] = useState(now)
  const [selected, setSelected] = useState<ChoiceNumber | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  function submit() {
    if (selected === null || attempt) return
    const a = createAttempt({ question, chosen: selected, sessionId, mode, shownAtMs, submittedAtMs: now() })
    setAttempt(a)
    onSubmitted?.(a)
    setSaveState('saving')
    storage
      .addAttempt(a)
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('failed'))
  }

  return (
    <div className={styles.player}>
      <QuestionView
        question={question}
        selected={attempt ? attempt.chosen : selected}
        onSelect={setSelected}
        {...(number !== undefined && { number })}
        {...(order !== undefined && { order })}
        {...(attempt && { answer: question.answer })}
      />

      {!attempt ? (
        <Button block size="lg" disabled={selected === null} onClick={submit}>
          {selected === null ? '보기를 고르세요' : '제출'}
        </Button>
      ) : (
        <>
          <AnswerFeedback
            question={question}
            chosen={attempt.chosen}
            elapsedSec={attempt.elapsedSec}
            {...(order !== undefined && { order })}
          />
          {saveState === 'failed' && (
            <p className={styles.error} role="alert">
              풀이 기록을 저장하지 못했습니다. 브라우저 저장 공간(사생활 보호 모드 등)을 확인하세요.
            </p>
          )}
          {footer}
        </>
      )}
    </div>
  )
}
