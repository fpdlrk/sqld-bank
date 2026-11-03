import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { SqlJsStatic } from 'sql.js'
import { setSqlEngineLoader } from '../src/engine'
import { useSqlEngine } from '../src/app/useSqlEngine'

function Probe({ autoLoad }: { autoLoad: boolean }) {
  const { status, load } = useSqlEngine(autoLoad)
  return (
    <>
      <p data-testid="status">{status}</p>
      <button onClick={load}>load</button>
    </>
  )
}

afterEach(() => setSqlEngineLoader(undefined))

describe('T4-2 로딩 표시 훅', () => {
  it('불러오는 동안 loading, 끝나면 ready', async () => {
    let resolve!: (v: SqlJsStatic) => void
    setSqlEngineLoader(() => new Promise<SqlJsStatic>((r) => (resolve = r)))
    render(<Probe autoLoad />)
    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    await act(async () => resolve({} as SqlJsStatic))
    expect(screen.getByTestId('status')).toHaveTextContent('ready')
  })

  it('autoLoad가 아니면 idle로 기다리고, 실패하면 error', async () => {
    setSqlEngineLoader(() => Promise.reject(new Error('x')))
    render(<Probe autoLoad={false} />)
    expect(screen.getByTestId('status')).toHaveTextContent('idle')
    await act(async () => {
      screen.getByRole('button').click()
    })
    expect(screen.getByTestId('status')).toHaveTextContent('error')
  })
})
