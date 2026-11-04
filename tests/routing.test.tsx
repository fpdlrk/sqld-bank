import { describe, it, expect } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { NAV_ITEMS } from '../src/app/nav'

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

const heading = () => screen.getByRole('heading', { level: 1 })

describe('T1-3 라우팅과 레이아웃', () => {
  it.each(NAV_ITEMS.map((item) => [item.label, item.path]))(
    '사이드 메뉴 "%s"을 누르면 해당 화면으로 이동한다',
    (label) => {
      // 일부러 다른 화면에서 시작해 실제로 이동이 일어나는지 본다
      renderAt(label === '홈' ? '/settings' : '/')
      const sidebar = screen.getByRole('navigation', { name: '주 메뉴' })
      fireEvent.click(within(sidebar).getByRole('link', { name: label }))
      expect(heading()).toHaveTextContent(label)
    },
  )

  it('하단 탭바에는 홈/연습/모의고사/오답/더보기 5칸이 있다', () => {
    renderAt('/')
    const tabbar = screen.getByRole('navigation', { name: '하단 탭' })
    const names = within(tabbar)
      .getAllByRole('link')
      .map((a) => a.textContent)
    expect(names).toEqual(['홈', '연습', '모의고사', '오답', '더보기'])
  })

  it('더보기 → 설정으로 이동할 수 있다', () => {
    renderAt('/')
    const tabbar = screen.getByRole('navigation', { name: '하단 탭' })
    fireEvent.click(within(tabbar).getByRole('link', { name: '더보기' }))
    expect(heading()).toHaveTextContent('더보기')
    fireEvent.click(within(screen.getByRole('main')).getByRole('link', { name: '설정' }))
    expect(heading()).toHaveTextContent('설정')
  })

  it('결과 화면은 주소의 기록 ID로 회차를 찾는다 (없는 ID면 안내)', async () => {
    renderAt('/result/abc123')
    expect(await screen.findByText('제출된 모의고사를 찾을 수 없습니다.')).toBeInTheDocument()
    expect(heading()).toHaveTextContent('결과')
  })

  it('없는 주소는 홈으로 보낸다', () => {
    renderAt('/no-such-page')
    expect(heading()).toHaveTextContent('홈')
  })

  it('설정 화면에 테마 전환 버튼이 있다', () => {
    renderAt('/settings')
    expect(screen.getByRole('radiogroup', { name: '화면 테마' })).toBeInTheDocument()
  })
})
