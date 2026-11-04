import type { ReactNode } from 'react'
import styles from './Card.module.css'

interface Props {
  title?: ReactNode
  /** 제목 오른쪽에 붙는 요소 (배지, 버튼 등) */
  actions?: ReactNode
  children: ReactNode
  /** CSS Modules 클래스는 타입상 undefined일 수 있어 함께 받는다 */
  className?: string | undefined
}

export function Card({ title, actions, children, className }: Props) {
  return (
    <section className={className ? `${styles.card} ${className}` : styles.card}>
      {(title || actions) && (
        <header className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
