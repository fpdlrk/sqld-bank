import { useTheme } from '../../app/theme'
import type { ThemePreference } from '../../app/theme'
import styles from './ThemeSwitch.module.css'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

/** 테마 3단 전환 버튼 (시스템 / 라이트 / 다크) */
export function ThemeSwitch() {
  const { preference, setPreference } = useTheme()

  return (
    <div className={styles.group} role="radiogroup" aria-label="화면 테마">
      {OPTIONS.map((opt) => {
        const selected = preference === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? `${styles.option} ${styles.selected}` : styles.option}
            onClick={() => setPreference(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
