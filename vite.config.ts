import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// GitHub Pages 배포 시 base 경로는 T9-2에서 설정한다.
export default defineConfig({
  plugins: [react()],
  test: {
    // 브라우저 API(DOM, IndexedDB)를 쓰는 테스트가 많으므로 jsdom 환경
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
})
