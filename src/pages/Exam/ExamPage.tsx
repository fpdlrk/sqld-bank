import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, DataTable } from '../../components'
import {
  EXAM_RULES,
  EXAM_SETTINGS_KEY,
  EXAM_TOTAL_QUESTIONS,
  TEMPLATE_RATIO_OPTIONS,
  buildExamPlan,
  chapterLabel,
  createExamSession,
  examRemaining,
  formatClock,
  normalizeExamSettings,
  recentExamRefs,
  type ExamPlan,
  type ExamSettings,
  type Question,
  type QuestionRef,
  type Session,
} from '../../domain'
import { TEMPLATE_INFO } from '../../engine'
import { getStorage } from '../../storage'
import { loadAllQuestions, loadSessionQuestions, resolvePracticeItems } from '../Practice/loadQuestions'
import { SingleChips } from '../Practice/OptionChips'
import { submitAndSave } from './examData'
import pageStyles from '../Page.module.css'
import styles from './Exam.module.css'

interface Loaded {
  questions: Question[]
  recent: Set<QuestionRef>
  settings: ExamSettings
  /** 제출하지 않은 시험 (가장 최근 것) */
  unfinished: Session | undefined
}

async function loadExamStart(): Promise<Loaded> {
  const storage = getStorage()
  const [questions, sessions, saved] = await Promise.all([
    loadAllQuestions(),
    storage.listSessions({ mode: 'exam' }).catch(() => []),
    storage.getMeta<unknown>(EXAM_SETTINGS_KEY).catch(() => undefined),
  ])
  return {
    questions,
    recent: recentExamRefs(sessions),
    settings: normalizeExamSettings(saved),
    unfinished: sessions.find((s) => s.finishedAt === null),
  }
}

const RATIO_OPTIONS = TEMPLATE_RATIO_OPTIONS.map((value) => ({ value, label: `${Math.round(value * 100)}%` }))

/** 모의고사 시작 화면 (T5-3) — 안내, 변형 문제 비율, 출제 구성 미리보기, 이어 풀기 */
export function ExamPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<Loaded | null>(null)
  const [settings, setSettings] = useState<ExamSettings | null>(null)
  const [seed, setSeed] = useState(0) // [다시 구성]용
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void loadExamStart().then((d) => {
      if (!alive) return
      setData(d)
      setSettings(d.settings)
    })
    return () => {
      alive = false
    }
  }, [])

  const plan: ExamPlan | null = useMemo(
    () =>
      data && settings
        ? buildExamPlan(data.questions, TEMPLATE_INFO, { templateRatio: settings.templateRatio, recentRefs: data.recent })
        : null,
    // seed: [다시 구성]을 누르면 바뀌어 새로 구성한다
    [data, settings, seed],
  )

  /** 제출하지 않은 시험을 지금 답안으로 제출 */
  async function closeExam(session: Session) {
    if (!data) return
    const questionsByRef = await loadSessionQuestions(session.questionRefs, data.questions)
    await submitAndSave({ session, questionsByRef })
  }

  async function start() {
    if (!data || !settings || !plan) return
    setPreparing(true)
    setError(null)
    try {
      const questions = await resolvePracticeItems(plan.items)
      const session = createExamSession(questions)
      // 시험은 하나씩 — 진행 중이던 시험은 지금 답안으로 제출 처리
      const storage = getStorage()
      const open = (await storage.listSessions({ mode: 'exam', unfinished: true })).filter((s) => s.id !== session.id)
      for (const s of open) await closeExam(s)
      await storage.putSession(session)
      void storage.setMeta(EXAM_SETTINGS_KEY, settings).catch(() => {})
      navigate(`/exam/${session.id}`)
    } catch {
      setPreparing(false)
      setError('시험을 준비하지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.')
    }
  }

  async function submitUnfinished() {
    if (!data?.unfinished) return
    const id = data.unfinished.id
    try {
      await closeExam(data.unfinished)
      navigate(`/result/${id}`)
    } catch {
      setError('시험을 제출하지 못했습니다.')
    }
  }

  const u = data?.unfinished
  const uRemaining = u ? examRemaining(u) : 0

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <h1>모의고사</h1>
        <p className={pageStyles.desc}>실제 시험처럼 50문항을 90분 안에 풉니다.</p>
      </header>

      {u && (
        <Card title="제출하지 않은 시험이 있습니다">
          <p>
            {u.questionRefs.length}문항 중 {Object.keys(u.progress?.answers ?? {}).length}문항 풀이 ·{' '}
            {uRemaining > 0 ? `남은 시간 ${formatClock(uRemaining)}` : '시간 종료 — 열면 바로 제출됩니다'}
          </p>
          <div className={styles.startActions}>
            <Button onClick={() => navigate(`/exam/${u.id}`)}>이어 풀기</Button>
            <Button variant="secondary" onClick={() => void submitUnfinished()}>
              지금 제출하기
            </Button>
          </div>
        </Card>
      )}

      <Card title="시험 안내">
        <ul className={styles.ruleList}>
          <li>
            1과목 {EXAM_RULES.subjects[1].questionCount}문항 + 2과목 {EXAM_RULES.subjects[2].questionCount}문항 = {EXAM_TOTAL_QUESTIONS}문항, {EXAM_RULES.durationMinutes}분
          </li>
          <li>
            문항당 {EXAM_RULES.pointsPerQuestion}점 · 합격 {EXAM_RULES.passScore}점 이상 · 과목별 40% 미만이면 과락
          </li>
          <li>남은 {EXAM_RULES.warningMinutes}분부터 경고, 시간이 끝나면 자동 제출</li>
          <li>새로고침하거나 앱을 바꿔도 답안과 남은 시간이 유지됩니다</li>
        </ul>
      </Card>

      {data && settings && plan && (
        <Card
          title="출제 구성"
          actions={
            <Button variant="ghost" onClick={() => setSeed((s) => s + 1)}>
              다시 구성
            </Button>
          }
        >
          <SingleChips
            label="변형 문제 비율 (2과목)"
            options={RATIO_OPTIONS}
            value={settings.templateRatio as (typeof TEMPLATE_RATIO_OPTIONS)[number]}
            onChange={(templateRatio) => setSettings({ templateRatio })}
          />
          <p>
            1과목 {plan.subjects[1].planned}/{plan.subjects[1].target}문항 · 2과목 {plan.subjects[2].planned}/
            {plan.subjects[2].target}문항 (변형 문제 {plan.subjects[2].templates}개)
          </p>
          {plan.shortage > 0 && (
            <p role="alert">
              문제은행이 모자라{' '}
              {([1, 2] as const)
                .filter((s) => plan.subjects[s].missing > 0)
                .map((s) => `${s}과목 ${plan.subjects[s].missing}문항`)
                .join(', ')}
              이 부족합니다. 부족한 만큼 줄여서 출제합니다. (고정 문제는 Phase 8에서 늘어납니다)
            </p>
          )}
          <details>
            <summary>단원별 구성 보기</summary>
            <DataTable
              columns={['단원', '목표', '고정 문제', '변형 문제']}
              rows={plan.chapters.map((c) => [chapterLabel(c.chapter), c.target, c.fixed, c.templates])}
            />
          </details>
        </Card>
      )}

      {error && (
        <p className={styles.warnBanner} role="alert">
          {error}
        </p>
      )}

      <div className={styles.startActions}>
        <Button size="lg" disabled={!plan || plan.items.length === 0 || preparing} onClick={() => void start()}>
          {preparing ? '시험을 준비하는 중…' : '시험 시작'}
        </Button>
        {!data && <p role="status">불러오는 중…</p>}
      </div>
    </div>
  )
}
