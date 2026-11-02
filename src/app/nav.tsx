import type { ReactNode } from 'react'

/**
 * 좌측 사이드 메뉴(데스크톱)와 하단 탭바(모바일)가 공유하는 메뉴 정의.
 * 아이콘은 라이브러리 없이 인라인 SVG로 둔다 (UI 프레임워크 추가 금지).
 */
export interface NavItem {
  path: string
  label: string
  /** 모바일 탭바에 표시할 짧은 이름 */
  shortLabel: string
  icon: ReactNode
  /** 모바일 하단 탭바 5칸에 넣을 항목인지 */
  inTabBar: boolean
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const HomeIcon = (
  <svg {...iconProps}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
  </svg>
)

const PracticeIcon = (
  <svg {...iconProps}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
    <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5Z" />
  </svg>
)

const ExamIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9.5V13l2.5 1.5" />
    <path d="M9.5 2.5h5" />
  </svg>
)

const WrongIcon = (
  <svg {...iconProps}>
    <path d="M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20Z" />
    <path d="M14.5 3.5V8H19" />
    <path d="M9.5 12.5l5 5M14.5 12.5l-5 5" />
  </svg>
)

const BankIcon = (
  <svg {...iconProps}>
    <ellipse cx="12" cy="6" rx="7.5" ry="3" />
    <path d="M4.5 6v12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" />
    <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" />
  </svg>
)

const SettingsIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
  </svg>
)

const MoreIcon = (
  <svg {...iconProps}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
)

/** 사이드 메뉴에 보이는 전체 메뉴 */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '홈', shortLabel: '홈', icon: HomeIcon, inTabBar: true },
  { path: '/practice', label: '단원별 연습', shortLabel: '연습', icon: PracticeIcon, inTabBar: true },
  { path: '/exam', label: '모의고사', shortLabel: '모의고사', icon: ExamIcon, inTabBar: true },
  { path: '/wrong', label: '오답노트', shortLabel: '오답', icon: WrongIcon, inTabBar: true },
  { path: '/bank', label: '문제 관리', shortLabel: '문제', icon: BankIcon, inTabBar: false },
  { path: '/settings', label: '설정', shortLabel: '설정', icon: SettingsIcon, inTabBar: false },
]

/** 모바일 탭바 5번째 칸 — 나머지 메뉴를 모아 보여 주는 "더보기" */
export const MORE_ITEM = {
  path: '/more',
  label: '더보기',
  shortLabel: '더보기',
  icon: MoreIcon,
} as const

/** "더보기" 화면에 들어가는 메뉴 (탭바에 자리가 없는 것들) */
export const MORE_MENU = NAV_ITEMS.filter((item) => !item.inTabBar)
