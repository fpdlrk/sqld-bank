import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '../src/app/theme'
import { ThemeSwitch } from '../src/components'

function renderSwitch() {
  return render(
    <ThemeProvider>
      <ThemeSwitch />
    </ThemeProvider>,
  )
}

describe('T1-2 테마 전환', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('처음에는 "시스템"이 선택되고 data-theme 속성이 없다', () => {
    renderSwitch()
    expect(screen.getByRole('radio', { name: '시스템' })).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('다크를 고르면 <html data-theme="dark">가 되고 저장된다', () => {
    renderSwitch()
    fireEvent.click(screen.getByRole('radio', { name: '다크' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('sqld-bank.theme')).toBe('dark')
  })

  it('다시 시스템을 고르면 data-theme 속성이 지워진다', () => {
    renderSwitch()
    fireEvent.click(screen.getByRole('radio', { name: '라이트' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    fireEvent.click(screen.getByRole('radio', { name: '시스템' }))
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('저장된 값이 있으면 다음 실행 때 그대로 불러온다', () => {
    localStorage.setItem('sqld-bank.theme', 'dark')
    renderSwitch()
    expect(screen.getByRole('radio', { name: '다크' })).toHaveAttribute('aria-checked', 'true')
  })
})
