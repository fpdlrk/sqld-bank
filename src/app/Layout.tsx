import { NavLink, Outlet, useLocation } from 'react-router'
import { MORE_ITEM, MORE_MENU, NAV_ITEMS } from './nav'
import styles from './Layout.module.css'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.link} ${styles.active}` : styles.link

const tabClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.tab} ${styles.active}` : styles.tab

/**
 * 전체 레이아웃 (T1-3)
 * - 데스크톱: 좌측 사이드 메뉴
 * - 모바일(≤768px): 하단 탭바 (홈/연습/모의고사/오답/더보기)
 * 두 메뉴는 항상 DOM에 있고, 보이고 숨기는 것은 CSS 미디어쿼리가 담당한다.
 */
export function Layout() {
  const { pathname } = useLocation()
  // "더보기" 안에 들어 있는 화면에 있을 때도 탭바의 "더보기"를 켜 둔다
  const inMore =
    pathname === MORE_ITEM.path || MORE_MENU.some((item) => pathname.startsWith(item.path))

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>SQLD 문제은행</div>
        <nav aria-label="주 메뉴">
          <ul className={styles.menu}>
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <NavLink to={item.path} end={item.path === '/'} className={linkClass}>
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className={styles.content}>
        <Outlet />
      </main>

      <nav className={styles.tabbar} aria-label="하단 탭">
        {NAV_ITEMS.filter((item) => item.inTabBar).map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} className={tabClass}>
            {item.icon}
            <span>{item.shortLabel}</span>
          </NavLink>
        ))}
        <NavLink to={MORE_ITEM.path} className={() => tabClass({ isActive: inMore })}>
          {MORE_ITEM.icon}
          <span>{MORE_ITEM.shortLabel}</span>
        </NavLink>
      </nav>
    </div>
  )
}
