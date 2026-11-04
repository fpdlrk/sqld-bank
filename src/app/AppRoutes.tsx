import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './Layout'
import {
  BankPage,
  DevPage,
  ExamPage,
  ExamRunPage,
  HomePage,
  MorePage,
  PracticePage,
  PracticeRunPage,
  ResultPage,
  SettingsPage,
  WrongNotePage,
} from '../pages'

/**
 * 화면 경로 목록 (docs/01 §7).
 * 라우터 종류(HashRouter)는 App.tsx에서 감싼다 — 테스트에서는 MemoryRouter로 감싸기 위해 분리.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="practice/:sessionId" element={<PracticeRunPage />} />
        <Route path="exam" element={<ExamPage />} />
        <Route path="exam/:sessionId" element={<ExamRunPage />} />
        <Route path="result/:sessionId" element={<ResultPage />} />
        <Route path="wrong" element={<WrongNotePage />} />
        <Route path="bank" element={<BankPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="more" element={<MorePage />} />
        {/* 임시 컴포넌트 견본 (T1-4) — 메뉴에는 없음 */}
        <Route path="dev" element={<DevPage />} />
        {/* 없는 주소는 홈으로 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
