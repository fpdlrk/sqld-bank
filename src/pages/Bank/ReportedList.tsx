import { useState } from 'react'
import { Button, Card, Markdown, QuestionView } from '../../components'
import {
  REPORT_KIND_LABELS,
  parseRef,
  type AnyQuestion,
  type Note,
  type Question,
  type QuestionRef,
  type QuestionReport,
} from '../../domain'
import { TEMPLATE_INFO } from '../../engine'
import { formatDay, loadQuestion } from '../WrongNote/wrongNoteData'
import styles from './Bank.module.css'

type Reported = Note & { report: QuestionReport }

interface Props {
  /** 최근 신고부터 */
  reported: readonly Reported[]
  /** 고정 문제 전체 (기본 + 직접 추가) */
  questions: readonly Question[]
  onEdit: (id: string) => void
  onClear: (ref: QuestionRef) => void
}

/** 문제 이름 — 고정 문제는 ID·주제, 변형 문제는 템플릿 주제·시드 */
function describe(ref: QuestionRef, questions: readonly Question[]): { title: string; userId: string | null } {
  const parsed = parseRef(ref)
  if (parsed.kind === 'template') {
    const t = TEMPLATE_INFO.find((x) => x.id === parsed.templateId)
    return { title: `변형 문제 ${parsed.templateId}${t ? ` · ${t.topic}` : ''} (시드 ${parsed.seed})`, userId: null }
  }
  const q = questions.find((x) => x.id === parsed.questionId)
  if (!q) return { title: `${ref} (지금은 없는 문제)`, userId: null }
  return { title: `${q.id} · ${q.topic}`, userId: q.source === 'user' ? q.id : null }
}

/** 오류 신고 모아 보기 (T7-5) */
export function ReportedList({ reported, questions, onEdit, onClear }: Props) {
  const [open, setOpen] = useState<QuestionRef | null>(null)
  const [loaded, setLoaded] = useState<{ ref: QuestionRef; question: AnyQuestion | null } | null>(null)

  async function toggle(ref: QuestionRef) {
    if (open === ref) {
      setOpen(null)
      return
    }
    setOpen(ref)
    setLoaded(null)
    // 변형 문제는 같은 시드로 다시 만든다
    const q = await loadQuestion(ref, questions).catch(() => undefined)
    setLoaded({ ref, question: q ?? null })
  }

  return (
    <Card title={`오류 신고 ${reported.length}개`}>
      <p className={styles.muted}>
        풀이 화면에서 [문제 오류 의심]으로 남긴 신고입니다. 문제를 고쳤거나 오해였다면 [신고 지우기]를 누르세요.
      </p>
      <ul className={styles.rows}>
        {reported.map((n) => {
          const { title, userId } = describe(n.questionRef, questions)
          const isOpen = open === n.questionRef
          return (
            <li key={n.questionRef} className={`${styles.row} ${styles.reportRow}`}>
              <p className={styles.reportTitle}>{title}</p>
              <p className={styles.reportBody}>
                <strong>{REPORT_KIND_LABELS[n.report.kind]}</strong>
                {n.report.detail && ` — ${n.report.detail}`}
                <span className={styles.muted}> · {formatDay(n.report.at)}</span>
              </p>
              <div className={styles.rowActions}>
                <Button variant="secondary" aria-expanded={isOpen} onClick={() => void toggle(n.questionRef)}>
                  {isOpen ? '문제 닫기' : '문제 보기'}
                </Button>
                {userId && (
                  <Button variant="secondary" onClick={() => onEdit(userId)}>
                    수정
                  </Button>
                )}
                <Button variant="ghost" onClick={() => onClear(n.questionRef)}>
                  신고 지우기
                </Button>
              </div>
              {isOpen && (
                <div className={styles.preview}>
                  {loaded?.ref !== n.questionRef ? (
                    <p role="status">문제를 불러오는 중…</p>
                  ) : loaded.question ? (
                    <>
                      <QuestionView question={loaded.question} answer={loaded.question.answer} />
                      <Markdown source={loaded.question.explanation} />
                      <p className={styles.point}>시험 포인트 · {loaded.question.examPoint}</p>
                    </>
                  ) : (
                    <p className={styles.muted}>문제를 찾을 수 없습니다.</p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
