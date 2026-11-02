import { ThemeSwitch } from '../../components'
import { useTheme } from '../../app/theme'
import { PagePlaceholder } from '../PagePlaceholder'
import styles from '../Page.module.css'

export function SettingsPage() {
  const { resolved } = useTheme()

  return (
    <PagePlaceholder
      title="설정"
      description="시험일, 화면 테마, 백업/복원, 데이터 초기화를 관리합니다."
      plannedIn="T7-4 (백업/복원)"
    >
      <section className={styles.card}>
        <h2>화면 테마</h2>
        <ThemeSwitch />
        <p className={styles.desc}>
          현재 적용: {resolved === 'dark' ? '다크' : '라이트'} — "시스템"은 기기 설정을 따릅니다.
        </p>
      </section>
    </PagePlaceholder>
  )
}
