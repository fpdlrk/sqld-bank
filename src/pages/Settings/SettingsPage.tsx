import { Card, ThemeSwitch } from '../../components'
import { useTheme } from '../../app/theme'
import { BackupSection } from './BackupSection'
import pageStyles from '../Page.module.css'

/** 설정 — 화면 테마, 전체 백업/복원 (T7-4) */
export function SettingsPage() {
  const { resolved } = useTheme()

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <h1>설정</h1>
        <p className={pageStyles.desc}>화면 테마와 기록 백업/복원을 관리합니다. 시험일은 홈에서 정합니다.</p>
      </header>

      <Card title="화면 테마">
        <ThemeSwitch />
        <p className={pageStyles.desc}>
          현재 적용: {resolved === 'dark' ? '다크' : '라이트'} — "시스템"은 기기 설정을 따릅니다.
        </p>
      </Card>

      <BackupSection />
    </div>
  )
}
