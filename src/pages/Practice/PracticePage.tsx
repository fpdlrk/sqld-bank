import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card } from '../../components'
import {
  PRACTICE_SETTINGS_KEY,
  createPracticeSession,
  finishSession,
  normalizePracticeSettings,
  pickPracticeItems,
  summarizeAttempts,
  type PracticeSettings,
  type Question,
  type QuestionRef,
  type QuestionStat,
  type Session,
} from '../../domain'
import { TEMPLATE_INFO } from '../../engine'
import { getStorage } from '../../storage'
import { loadAllQuestions, loadSessionQuestions, resolvePracticeItems } from './loadQuestions'
import { PracticeSetup } from './PracticeSetup'
import styles from '../Page.module.css'
import runStyles from './PracticeRun.module.css'

interface Loaded {
  questions: Question[]
  stats: Map<QuestionRef, QuestionStat>
  settings: PracticeSettings
  /** 끝나지 않은 연습 (가장 최근 것) */
  unfinished: Session | undefined
}

/** 문제·풀이 기록·마지막 설정·진행 중인 연습을 불러온다. 저장소를 못 열면 기본값으로 */
async function loadPracticeData(): Promise<Loaded> {
  const storage = getStorage()
  const [questions, attempts, saved, sessions] = await Promise.all([
    loadAllQuestions(),
    storage.listAttempts().catch(() => []),
    storage.getMeta<unknown>(PRACTICE_SETTINGS_KEY).catch(() => undefined),
    storage.listSessions({ mode: 'practice', unfinished: true }).catch(() => []),
  ])
  return {
    questions,
    stats: summarizeAttempts(attempts),
    settings: normalizePracticeSettings(saved),
    unfinished: sessions[0],
  }
}

const SAVE_ERROR = '연습을 저장하지 못했습니다. 브라우저 저장 공간(사생활 보호 모드 등)을 확인하세요.'

/** 연습 설정 화면 (T3-3) + 시작·이어 풀기 (T3-4) */
export function PracticePage() {
  const navigate = useNavigate()
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 변형 문제를 만드는 동안 (처음에는 SQL 실행기 로딩 포함)
  const [preparing, setPreparing] = useState(false)

  useEffect(() => {
    let alive = true
    void loadPracticeData().then((d) => {
      if (alive) setData(d)
    })
    return () => {
      alive = false
    }
  }, [])

  /** 진행 중인 연습을 끝냄 (안 푼 문제는 결과에서 빠짐) */
  async function closeSession(session: Session) {
    if (!data) return
    // 변형 문제도 다시 만들어야 맞힌 수를 제대로 셀 수 있다
    const questionsByRef = await loadSessionQuestions(session.questionRefs, data.questions)
    await getStorage().putSession(finishSession(session, questionsByRef))
  }

  async function start(settings: PracticeSettings) {
    if (!data) return
    const storage = getStorage()
    setError(null)
    setPreparing(true)
    let session: Session
    try {
      const items = pickPracticeItems(data.questions, TEMPLATE_INFO, settings, data.stats)
      const questions = await resolvePracticeItems(items)
      session = createPracticeSession(questions, { shuffleChoices: settings.shuffleChoices })
    } catch {
      setPreparing(false)
      setError('변형 문제를 만들지 못했습니다. 새로고침한 뒤 다시 시도하거나, "변형 문제 포함"을 끄고 시작하세요.')
      return
    }
    try {
      // 진행 중인 연습은 하나만 — 새로 시작하면 이전 연습은 끝난 것으로 처리
      const others = await storage.listSessions({ mode: 'practice', unfinished: true })
      await Promise.all(others.map(closeSession))
      await storage.putSession(session)
    } catch {
      setPreparing(false)
      setError(SAVE_ERROR)
      return
    }
    // 다음에 들어왔을 때 같은 설정으로 시작하도록 기억 (실패해도 연습은 진행)
    void storage.setMeta(PRACTICE_SETTINGS_KEY, settings).catch(() => {})
    navigate(`/practice/${session.id}`)
  }

  async function finishUnfinished() {
    if (!data?.unfinished) return
    await closeSession(data.unfinished).catch(() => setError(SAVE_ERROR))
    setData({ ...data, unfinished: undefined })
  }

  const u = data?.unfinished
  const answeredCount = u ? Object.keys(u.progress?.answers ?? {}).length : 0

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>단원별 연습</h1>
        <p className={styles.desc}>과목·단원·유형·난이도를 골라 문제를 풀고 바로 해설을 봅니다.</p>
      </header>

      {u && (
        <Card title="진행 중인 연습이 있습니다">
          <p>
            {u.questionRefs.length}문제 중 {answeredCount}문제 풀이 · {formatStarted(u.startedAt)} 시작
          </p>
          <div className={runStyles.actions}>
            <Button onClick={() => navigate(`/practice/${u.id}`)}>이어 풀기</Button>
            <Button variant="secondary" onClick={() => void finishUnfinished()}>
              끝내기
            </Button>
          </div>
        </Card>
      )}

      {error && (
        <p className={runStyles.warn} role="alert">
          {error}
        </p>
      )}

      {!data ? (
        <p role="status">불러오는 중…</p>
      ) : (
        <PracticeSetup
          questions={data.questions}
          templates={TEMPLATE_INFO}
          stats={data.stats}
          preparing={preparing}
          initialSettings={data.settings}
          onStart={(s) => void start(s)}
        />
      )}
    </div>
  )
}

/** "11월 3일 10:05" */
function formatStarted(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`
}
