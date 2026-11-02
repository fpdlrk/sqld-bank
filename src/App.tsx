import { HashRouter } from 'react-router'
import { ThemeProvider } from './app/theme'
import { AppRoutes } from './app/AppRoutes'

// HashRouter: 주소가 #/practice 형태라 GitHub Pages에서 새로고침해도 404가 나지 않는다.
export default function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ThemeProvider>
  )
}
