// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

/**
 * PWA 설정 (T9-1)
 * 실제 서비스 워커 동작은 빌드 결과에서만 확인할 수 있으므로,
 * 여기서는 설정이 빠지거나 아이콘 파일이 사라지는 실수를 막는다.
 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]
const config = readFileSync('vite.config.ts', 'utf8')

describe('T9-1 PWA 설정', () => {
  it.each(['pwa-192x192.png', 'pwa-512x512.png', 'maskable-512x512.png', 'apple-touch-icon.png', 'favicon-32x32.png'])(
    '아이콘 %s 이 PNG 파일로 있다',
    (name) => {
      const path = `public/${name}`
      expect(existsSync(path)).toBe(true)
      expect([...readFileSync(path).subarray(0, 4)]).toEqual(PNG_SIGNATURE)
    },
  )

  it('오프라인 캐시에 sql.js WASM이 포함되고, manifest가 상대 경로로 시작한다', () => {
    expect(config).toMatch(/globPatterns:.*wasm/)
    expect(config).toContain("start_url: './'")
    expect(config).toContain("purpose: 'maskable'")
  })
})
