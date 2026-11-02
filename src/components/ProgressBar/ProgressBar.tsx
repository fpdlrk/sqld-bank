import styles from './ProgressBar.module.css'

interface Props {
  value: number
  max?: number
  /** 스크린리더용 이름이자 막대 위에 보이는 라벨 */
  label: string
  /** 오른쪽에 "3 / 10" 같은 수치를 보여 줄지 */
  showValue?: boolean
  tone?: 'primary' | 'success' | 'danger' | 'warning'
}

export function ProgressBar({ value, max = 100, label, showValue = true, tone = 'primary' }: Props) {
  // 범위를 벗어난 값이 와도 막대가 넘치지 않게
  const safeMax = max > 0 ? max : 1
  const clamped = Math.min(Math.max(value, 0), safeMax)
  const percent = (clamped / safeMax) * 100

  return (
    <div className={styles.wrap}>
      <div className={styles.labels}>
        <span>{label}</span>
        {showValue && (
          <span className={styles.value}>
            {clamped} / {safeMax}
          </span>
        )}
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
      >
        <div className={`${styles.fill} ${styles[tone]}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
