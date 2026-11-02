import type { ReactNode } from 'react'
import styles from './Badge.module.css'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info'

interface Props {
  tone?: BadgeTone
  children: ReactNode
}

/** 단원 코드, 난이도, 정답/오답 표시 등에 쓰는 작은 꼬리표 */
export function Badge({ tone = 'neutral', children }: Props) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}
