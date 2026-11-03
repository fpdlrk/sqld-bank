import styles from './PracticeSetup.module.css'

export interface ChipOption<T> {
  value: T
  label: string
}

interface MultiProps<T> {
  label: string
  options: readonly ChipOption<T>[]
  selected: readonly T[]
  onChange: (next: T[]) => void
}

/** 여러 개 고르는 꼬리표 버튼 묶음 — 아무것도 안 고르면 "전체" */
export function MultiChips<T extends string | number>({ label, options, selected, onChange }: MultiProps<T>) {
  const toggle = (v: T) => onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={styles.chip}
          aria-pressed={selected.includes(o.value)}
          onClick={() => toggle(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface SingleProps<T> {
  label: string
  options: readonly ChipOption<T>[]
  value: T
  onChange: (next: T) => void
}

/** 하나만 고르는 버튼 묶음 (라디오 버튼과 같은 동작) */
export function SingleChips<T extends string | number>({ label, options, value, onChange }: SingleProps<T>) {
  return (
    <div className={styles.chips} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          className={styles.chip}
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
