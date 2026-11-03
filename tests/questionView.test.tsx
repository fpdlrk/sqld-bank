/// <reference types="node" />
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import { Markdown, QuestionView, parseInline, parseMarkdown } from '../src/components'
import type { Question } from '../src/domain'

const byId = (id: string) => BUILT_IN_QUESTIONS.find((q) => q.id === id) as Question

describe('T3-1 Markdown 해석', () => {
  it('문단·줄바꿈·목록·표·코드블록을 나눈다', () => {
    const md = [
      '첫 줄',
      '둘째 줄',
      '',
      '- 가',
      '- 나',
      '',
      '1. 하나',
      '2. 둘',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | NULL |',
      '',
      '```sql',
      'SELECT * FROM T;',
      '```',
    ].join('\n')
    expect(parseMarkdown(md)).toEqual([
      { type: 'paragraph', lines: ['첫 줄', '둘째 줄'] },
      { type: 'list', ordered: false, items: ['가', '나'] },
      { type: 'list', ordered: true, items: ['하나', '둘'] },
      { type: 'table', columns: ['A', 'B'], rows: [['1', 'NULL']] },
      { type: 'code', lang: 'sql', code: 'SELECT * FROM T;' },
    ])
  })

  it('구분줄이 없는 | 는 표가 아니라 글자', () => {
    expect(parseMarkdown('A | B 중 하나')).toEqual([{ type: 'paragraph', lines: ['A | B 중 하나'] }])
  })

  it('굵게·인라인 코드, 단독 * 는 기울임으로 보지 않는다', () => {
    expect(parseInline('**옳지 않은** 것은? `COUNT(*)`와 COUNT(*) * 2')).toEqual([
      { type: 'strong', children: [{ type: 'text', text: '옳지 않은' }] },
      { type: 'text', text: ' 것은? ' },
      { type: 'code', text: 'COUNT(*)' },
      { type: 'text', text: '와 COUNT(*) * 2' },
    ])
    // 코드 안의 ** 는 굵게가 아니다
    expect(parseInline('`a ** b`')).toEqual([{ type: 'code', text: 'a ** b' }])
    expect(parseInline('**COUNT(*)**')).toEqual([{ type: 'strong', children: [{ type: 'text', text: 'COUNT(*)' }] }])
  })

  it('HTML은 글자 그대로 보인다 (실행되지 않음)', () => {
    const { container } = render(<Markdown source={'<img src=x onerror="alert(1)"> 와 <b>굵게</b>'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<b>굵게</b>')
  })

  it('해설 표는 DataTable로 — NULL 표시', () => {
    render(<Markdown source={'| X |\n|---|\n| NULL |\n| 3 |'} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('NULL')).toBeInTheDocument()
    expect(within(table).getByText('3')).toBeInTheDocument()
  })
})

describe('T3-1 QuestionView', () => {
  it('본문·예시 테이블·SQL·보기 4개를 보여 준다', () => {
    const q = byId('S1-03-0001')
    render(<QuestionView question={q} number={3} />)
    expect(screen.getByRole('article', { name: '문제 3' })).toBeInTheDocument()
    expect(screen.getByText(/테이블에 SQL을 실행한 결과/)).toBeInTheDocument()
    expect(screen.getByText('[PAY]')).toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(q.tables!.length)
    expect(document.querySelector('pre')?.textContent).toBe(q.sql)
    const buttons = within(screen.getByRole('list', { name: '보기' })).getAllByRole('button')
    expect(buttons).toHaveLength(4)
    expect(buttons[0]).toHaveTextContent(`①${q.choices[0]}`)
  })

  it('단원·유형·난이도 꼬리표', () => {
    render(<QuestionView question={byId('S2-04-0001')} />)
    expect(screen.getByText('S2-04 윈도우 함수', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('빈칸형')).toBeInTheDocument()
  })

  it('보기 순서를 바꿔도 ①은 첫 위치, 선택은 원래 번호로 알려 준다', () => {
    const q = byId('M1-01-0001')
    const onSelect = vi.fn()
    render(<QuestionView question={q} order={[4, 3, 2, 1]} selected={3} onSelect={onSelect} />)
    const buttons = within(screen.getByRole('list', { name: '보기' })).getAllByRole('button')
    expect(buttons[0]).toHaveTextContent(`①${q.choices[3]}`)
    // 원래 3번은 두 번째 위치(②)에 있고, 선택 표시가 붙는다
    expect(buttons[1]).toHaveTextContent(`②${q.choices[2]}`)
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(buttons[0]!)
    expect(onSelect).toHaveBeenCalledWith(4)
  })

  it('disabled면 누를 수 없다', () => {
    const onSelect = vi.fn()
    render(<QuestionView question={byId('M1-01-0001')} onSelect={onSelect} disabled />)
    const first = within(screen.getByRole('list', { name: '보기' })).getAllByRole('button')[0]!
    expect(first).toBeDisabled()
    fireEvent.click(first)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('SQL 문장 보기는 고정폭(code)으로, 일반 보기는 글로 보여 준다', () => {
    const { unmount } = render(<QuestionView question={byId('S1-05-0001')} />)
    let buttons = within(screen.getByRole('list', { name: '보기' })).getAllByRole('button')
    expect(buttons.every((b) => b.querySelector('code') !== null)).toBe(true)
    unmount()

    render(<QuestionView question={byId('M1-01-0001')} />)
    buttons = within(screen.getByRole('list', { name: '보기' })).getAllByRole('button')
    expect(buttons.some((b) => b.querySelector('code') !== null)).toBe(false)
  })

  it.each(BUILT_IN_QUESTIONS.map((q) => [q.id, q] as const))('%s 가 오류 없이 그려진다', (_id, q) => {
    render(<QuestionView question={q} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('보기 버튼은 최소 44px(--tap-min)', () => {
    const css = readFileSync(join(process.cwd(), 'src/components/QuestionView/QuestionView.module.css'), 'utf8')
    expect(css).toMatch(/\.choice \{[^}]*min-height: var\(--tap-min\)/)
  })
})

describe('T3-1 #/dev 미리보기', () => {
  it('QuestionView 견본 카드가 목록에 추가됐다', async () => {
    const { MemoryRouter } = await import('react-router')
    const { ThemeProvider } = await import('../src/app/theme')
    const { AppRoutes } = await import('../src/app/AppRoutes')
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dev']}>
          <AppRoutes />
        </MemoryRouter>
      </ThemeProvider>,
    )
    expect(screen.getByRole('heading', { name: 'QuestionView' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByText(/^2 \/ \d+ \(/)).toBeInTheDocument()
    expect(screen.getByRole('article', { name: '문제 2' })).toBeInTheDocument()
  })
})
