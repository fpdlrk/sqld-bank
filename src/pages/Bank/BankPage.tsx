import { BUILT_IN_QUESTIONS } from '../../data/builtInQuestions'
import { filterQuestions, mergeQuestions } from '../../domain'
import { PagePlaceholder } from '../PagePlaceholder'
import styles from '../Page.module.css'

export function BankPage() {
  // 직접 추가 문제는 저장소(T2-6) 연결 후 합친다
  const { questions } = mergeQuestions([...BUILT_IN_QUESTIONS])
  const subject1 = filterQuestions(questions, { subjects: [1] }).length
  const subject2 = filterQuestions(questions, { subjects: [2] }).length

  return (
    <PagePlaceholder
      title="문제 관리"
      description="전체 문제를 검색하고, 직접 추가·수정하고, JSON으로 가져오거나 내보냅니다."
      plannedIn="T7-1 ~ T7-3"
    >
      <section className={styles.card}>
        <h2>문제 은행</h2>
        <p>
          전체 <strong>{questions.length}</strong>문제 — 1과목 {subject1} · 2과목 {subject2}
        </p>
      </section>
    </PagePlaceholder>
  )
}
