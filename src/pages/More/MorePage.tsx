import { Link } from 'react-router'
import { MORE_MENU } from '../../app/nav'
import styles from './MorePage.module.css'
import pageStyles from '../Page.module.css'

/** 모바일 탭바의 "더보기" — 탭바에 자리가 없는 메뉴를 모아 보여 준다 */
export function MorePage() {
  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <h1>더보기</h1>
      </header>
      <ul className={styles.list}>
        {MORE_MENU.map((item) => (
          <li key={item.path}>
            <Link to={item.path} className={styles.item}>
              {item.icon}
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
