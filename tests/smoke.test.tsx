import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

describe('앱 기본 동작', () => {
  it('App을 띄우면 홈 화면이 나온다', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('홈')
  })

  it('테스트 환경에 IndexedDB(fake-indexeddb)가 준비되어 있다', () => {
    expect(globalThis.indexedDB).toBeDefined()
  })
})
