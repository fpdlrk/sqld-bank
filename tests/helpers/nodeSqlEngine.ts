/// <reference types="node" />
/**
 * 테스트용 sql.js 로더 (T4-7)
 * jsdom 환경에서는 sql.js가 브라우저로 착각해 WASM을 주소로 받으려다 실패한다.
 * WASM 파일을 직접 읽어 넘겨 주면 jsdom에서도 진짜 sql.js로 화면 흐름을 검사할 수 있다.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import initSqlJs from 'sql.js'
import { setSqlEngineLoader } from '../../src/engine'

export function useNodeSqlEngine(): void {
  const wasm = readFileSync(join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'))
  const wasmBinary = wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer
  setSqlEngineLoader(() => initSqlJs({ wasmBinary }))
}
