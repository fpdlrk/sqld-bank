import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '../src/app/theme'
import { AppRoutes } from '../src/app/AppRoutes'
import { DataTable, ProgressBar, Tabs, highlightSql } from '../src/components'

describe('T1-4 #/dev 견본 화면', () => {
  // Card는 나머지 견본을 감싸는 틀이라 따로 제목이 없다 — 아래 제목들이 보이면 Card도 렌더링된 것
  it.each(['Button', 'Badge', 'ProgressBar', 'Modal', 'Tabs', 'CodeBlock', 'DataTable'])(
    '%s 견본 카드가 렌더링된다',
    (name) => {
      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={['/dev']}>
            <AppRoutes />
          </MemoryRouter>
        </ThemeProvider>,
      )
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    },
  )

  it('모달은 버튼으로 열리고 Esc로 닫힌다', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dev']}>
          <AppRoutes />
        </MemoryRouter>
      </ThemeProvider>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '모달 열기' }))
    expect(screen.getByRole('dialog', { name: '시험을 제출할까요?' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('DataTable', () => {
  it('NULL은 "NULL" 글자로, 0행이면 안내 문구로 보여 준다', () => {
    const { rerender } = render(<DataTable name="EMP" columns={['ID', 'BONUS']} rows={[[1, null]]} />)
    expect(screen.getByText('[EMP]')).toBeInTheDocument()
    expect(screen.getByText('NULL')).toBeInTheDocument()

    rerender(<DataTable columns={['ID']} rows={[]} />)
    expect(screen.getByText(/0행/)).toBeInTheDocument()
  })
})

describe('ProgressBar', () => {
  it('범위를 벗어난 값은 0~max로 자른다', () => {
    render(<ProgressBar label="진행" value={15} max={10} />)
    expect(screen.getByRole('progressbar', { name: '진행' })).toHaveAttribute('aria-valuenow', '10')
  })
})

describe('Tabs', () => {
  it('탭을 누르거나 → 키로 패널이 바뀐다', () => {
    render(
      <Tabs
        label="테스트"
        items={[
          { id: 'a', label: 'A탭', content: 'A내용' },
          { id: 'b', label: 'B탭', content: 'B내용' },
        ]}
      />,
    )
    expect(screen.getByRole('tabpanel')).toHaveTextContent('A내용')
    fireEvent.click(screen.getByRole('tab', { name: 'B탭' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('B내용')
    fireEvent.keyDown(within(screen.getByRole('tablist')).getByRole('tab', { name: 'B탭' }), {
      key: 'ArrowRight',
    })
    expect(screen.getByRole('tabpanel')).toHaveTextContent('A내용')
  })
})

describe('highlightSql', () => {
  const sql = `-- 주석\nSELECT NVL(bonus, 0), 'O''NEIL' FROM emp WHERE sal > 1000.5;`
  const tokens = highlightSql(sql)
  const typeOf = (text: string) => tokens.find((t) => t.text.includes(text))?.type

  it('토큰을 이어 붙이면 원문과 같다 (공백·줄바꿈 보존)', () => {
    expect(tokens.map((t) => t.text).join('')).toBe(sql)
  })

  it('종류를 구분한다', () => {
    expect(typeOf('-- 주석')).toBe('comment')
    expect(typeOf('SELECT')).toBe('keyword')
    expect(typeOf('NVL')).toBe('function')
    expect(typeOf("'O''NEIL'")).toBe('string')
    expect(typeOf('1000.5')).toBe('number')
    expect(typeOf('emp')).toBe('plain')
  })

  it('소문자 예약어도 인식한다', () => {
    expect(highlightSql('select 1 from dual')[0]).toEqual({ type: 'keyword', text: 'select' })
  })
})
