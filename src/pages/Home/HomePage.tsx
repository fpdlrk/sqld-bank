import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Card, ProgressBar, TrendChart } from '../../components'
import {
  EXAM_MAX_SCORE,
  EXAM_RULES,
  STATS_WINDOW_DAYS,
  WEAK_MIN_ATTEMPTS,
  daysUntil,
  examRemaining,
  formatClock,
  formatDDay,
  type Session,
} from '../../domain'
import { loadDashboard, presetPracticeChapter, saveExamDate, type Dashboard } from './statsData'
import pageStyles from '../Page.module.css'
import styles from './Home.module.css'

/** 홈 대시보드 (T6-5) — D-day, 이어 풀기, 과목별 정답률, 모의고사 추이, 취약 단원 */
export function HomePage() {
  const navigate = useNavigate()
  const [data, setData] = useState<Dashboard | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    loadDashboard()
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  async function practiceChapter(chapter: Parameters<typeof presetPracticeChapter>[0]) {
    await presetPracticeChapter(chapter).catch(() => {})
    navigate('/practice')
  }

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <h1>홈</h1>
      </header>

      {failed && <p role="alert">기록을 불러오지 못했습니다.</p>}
      {!data && !failed && <p role="status">불러오는 중…</p>}

      {data && data.backupDays !== null && (
        <aside className={styles.backupBanner} aria-label="백업 권장">
          <p className={styles.bannerText}>
            {data.everBackedUp
              ? `마지막 백업 후 ${data.backupDays}일이 지났습니다.`
              : `기록을 시작한 지 ${data.backupDays}일이 지났는데 아직 백업한 적이 없습니다.`}{' '}
            브라우저 데이터가 지워지면 기록도 사라지니 백업 파일을 받아 두세요.
          </p>
          <Button variant="secondary" onClick={() => navigate('/settings')}>
            설정에서 백업하기
          </Button>
        </aside>
      )}

      {data && (
        <div className={styles.grid}>
          <ExamDateCard
            examDate={data.examDate}
            onSave={async (date) => {
              await saveExamDate(date)
              setData({ ...data, examDate: date })
            }}
          />

          <ContinueCard sessions={data.unfinished} />

          <Card title={`과목별 정답률 (최근 ${STATS_WINDOW_DAYS}일)`}>
            {([1, 2] as const).map((s) => {
              const acc = data.stats.subjects[s]
              return acc.attempts === 0 ? (
                <p key={s} className={styles.muted}>
                  {s}과목: 아직 푼 기록이 없습니다.
                </p>
              ) : (
                <div key={s}>
                  <ProgressBar
                    label={`${s}과목 정답률 ${acc.rate}%`}
                    value={acc.correct}
                    max={acc.attempts}
                    tone={acc.rate < 40 ? 'danger' : acc.rate < 60 ? 'warning' : 'success'}
                  />
                </div>
              )
            })}
          </Card>

          <Card title="취약 단원">
            {data.stats.weak.length === 0 ? (
              <p className={styles.muted}>
                최근 {STATS_WINDOW_DAYS}일 동안 {WEAK_MIN_ATTEMPTS}번 이상 푼 단원이 생기면 정답률이 낮은 단원을 알려 드립니다.
              </p>
            ) : (
              <ol className={styles.weakList}>
                {data.stats.weak.map((c) => (
                  <li key={c.chapter} className={styles.weakItem}>
                    <span className={styles.weakName}>
                      {c.label}
                      <span className={styles.muted}>
                        {' '}
                        · 정답률 {c.rate}% ({c.correct}/{c.attempts})
                      </span>
                    </span>
                    <Button variant="secondary" onClick={() => void practiceChapter(c.chapter)}>
                      연습하기
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="모의고사 점수 추이" className={styles.wide}>
            {data.stats.trend.length === 0 ? (
              <p className={styles.muted}>
                아직 제출한 모의고사가 없습니다. <Link to="/exam">모의고사 보기</Link>
              </p>
            ) : (
              <TrendChart
                summary={`모의고사 ${data.stats.trend.length}회, 최근 ${data.stats.trend.at(-1)?.percent}%`}
                threshold={{ value: Math.round((EXAM_RULES.passScore / EXAM_MAX_SCORE) * 100), label: '합격선 60%' }}
                points={data.stats.trend.map((t) => {
                  const d = new Date(t.at)
                  return {
                    label: `${d.getMonth() + 1}/${d.getDate()}`,
                    value: t.percent,
                    detail: `${t.score}/${t.maxScore}점 · ${t.passed ? '합격' : '불합격'}`,
                  }
                })}
              />
            )}
          </Card>

          <nav className={`${styles.quick} ${styles.wide}`} aria-label="바로가기">
            <Button variant="secondary" onClick={() => navigate('/practice')}>
              단원별 연습
            </Button>
            <Button variant="secondary" onClick={() => navigate('/exam')}>
              모의고사
            </Button>
            <Button variant="secondary" onClick={() => navigate('/wrong')}>
              오답노트
            </Button>
          </nav>
        </div>
      )}
    </div>
  )
}

/** 시험 D-day — 정하지 않았으면 입력 칸 */
function ExamDateCard({ examDate, onSave }: { examDate: string | undefined; onSave: (date: string | undefined) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(examDate ?? '')
  const showForm = editing || !examDate

  return (
    <Card title="시험 D-day">
      {!showForm && examDate ? (
        <div className={styles.dday}>
          <p className={styles.ddayNumber}>{formatDDay(daysUntil(examDate))}</p>
          <p className={styles.muted}>시험일 {examDate}</p>
          <Button variant="ghost" onClick={() => setEditing(true)}>
            시험일 바꾸기
          </Button>
        </div>
      ) : (
        <form
          className={styles.dateForm}
          onSubmit={(e) => {
            e.preventDefault()
            void onSave(value || undefined).then(() => setEditing(false))
          }}
        >
          <label className={styles.dateLabel}>
            시험일
            <input type="date" value={value} onChange={(e) => setValue(e.target.value)} className={styles.dateInput} />
          </label>
          <Button type="submit" disabled={!value}>
            저장
          </Button>
          {examDate && (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              취소
            </Button>
          )}
        </form>
      )}
    </Card>
  )
}

const MODE_LABEL = { practice: '단원별 연습', review: '오답 복습', exam: '모의고사' } as const

/** 이어 풀기 — 끝내지 않은 연습·복습·모의고사 */
function ContinueCard({ sessions }: { sessions: readonly Session[] }) {
  return (
    <Card title="이어 풀기">
      {sessions.length === 0 ? (
        <p className={styles.muted}>진행 중인 연습이나 시험이 없습니다.</p>
      ) : (
        <ul className={styles.continueList}>
          {sessions.map((s) => {
            const answered = Object.keys(s.progress?.answers ?? {}).length
            const remaining = s.mode === 'exam' ? examRemaining(s) : 0
            return (
              <li key={s.id}>
                <Link to={s.mode === 'exam' ? `/exam/${s.id}` : `/practice/${s.id}`} className={styles.continueLink}>
                  <strong>{MODE_LABEL[s.mode]}</strong>
                  <span className={styles.muted}>
                    {s.questionRefs.length}문제 중 {answered}문제 풀이
                    {s.mode === 'exam' && (remaining > 0 ? ` · 남은 시간 ${formatClock(remaining)}` : ' · 시간 종료')}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
