import type { ReactNode } from 'react'
import styles from './Page.module.css'

interface Props {
  title: string
  description: string
  /** 이 화면을 실제로 만드는 Task (예: "T3-3") */
  plannedIn: string
  children?: ReactNode
}

/** 아직 기능이 없는 화면의 공통 틀 (T1-3). 각 화면이 완성되면 이 컴포넌트를 걷어낸다. */
export function PagePlaceholder({ title, description, plannedIn, children }: Props) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{title}</h1>
        <p className={styles.desc}>{description}</p>
      </header>
      {children}
      <p className={styles.todo}>이 화면의 기능은 {plannedIn}에서 만듭니다.</p>
    </div>
  )
}
