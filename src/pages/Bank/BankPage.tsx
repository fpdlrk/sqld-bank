import { useEffect, useState } from 'react'
import { BUILT_IN_QUESTIONS } from '../../data/builtInQuestions'
import { filterQuestions, mergeQuestions, type UserQuestion } from '../../domain'
import { getStorage } from '../../storage'
import { PagePlaceholder } from '../PagePlaceholder'
import styles from '../Page.module.css'

export function BankPage() {
  const [userQuestions, setUserQuestions] = useState<UserQuestion[]>([])

  // 직접 추가 문제는 저장소(IndexedDB)에서 불러온다
  useEffect(() => {
    let alive = true
    getStorage()
      .listUserQuestions()
      .then((list) => {
        if (alive) setUserQuestions(list)
      })
      .catch(() => {
        // 저장소를 열 수 없는 환경(사생활 보호 모드 등)이면 기본 문제만 보여 준다
      })
    return () => {
      alive = false
    }
  }, [])

  const { questions } = mergeQuestions([...BUILT_IN_QUESTIONS], userQuestions)
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
          {' '}(직접 추가 {userQuestions.length})
        </p>
      </section>
    </PagePlaceholder>
  )
}
