import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

describe('T0-3 초기화 확인', () => {
  it('App이 제목을 렌더링한다', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SQLD 문제은행')
  })

  it('테스트 환경에 IndexedDB(fake-indexeddb)가 준비되어 있다', () => {
    expect(globalThis.indexedDB).toBeDefined()
  })
})
