import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import styles from './Tabs.module.css'

export interface TabItem {
  id: string
  label: ReactNode
  content: ReactNode
}

interface Props {
  items: TabItem[]
  /** 처음 선택할 탭 id (없으면 첫 번째) */
  defaultId?: string
  /** 탭 목록의 스크린리더용 이름 */
  label: string
}

/** 탭 전환. 키보드 ←/→/Home/End로 이동할 수 있다. */
export function Tabs({ items, defaultId, label }: Props) {
  const baseId = useId()
  const [activeId, setActiveId] = useState(defaultId ?? items[0]?.id)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  )
  const active = items[activeIndex]

  const moveTo = (index: number) => {
    const item = items[index]
    if (!item) return
    setActiveId(item.id)
    tabRefs.current[index]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const last = items.length - 1
    if (e.key === 'ArrowRight') moveTo(activeIndex === last ? 0 : activeIndex + 1)
    else if (e.key === 'ArrowLeft') moveTo(activeIndex === 0 ? last : activeIndex - 1)
    else if (e.key === 'Home') moveTo(0)
    else if (e.key === 'End') moveTo(last)
    else return
    e.preventDefault()
  }

  return (
    <div className={styles.tabs}>
      <div className={`${styles.list} scroll-x`} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {items.map((item, i) => {
          const selected = i === activeIndex
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className={selected ? `${styles.tab} ${styles.selected}` : styles.tab}
              onClick={() => setActiveId(item.id)}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {active && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          className={styles.panel}
        >
          {active.content}
        </div>
      )}
    </div>
  )
}
