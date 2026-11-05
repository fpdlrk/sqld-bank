import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 배포 경로 (T9-2): 기본은 '/' (Netlify·Cloudflare Pages·로컬).
// GitHub Pages는 https://아이디.github.io/sqld-bank/ 처럼 하위 경로라서 배포 워크플로가 BASE_PATH=/sqld-bank/ 를 넘긴다.
// 화면 이동은 HashRouter(#/…)라서 경로가 바뀌어도 새로고침 404가 나지 않는다.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    // PWA (T9-1): 홈 화면에 추가 + 오프라인 동작
    // 빌드할 때 서비스 워커(sw.js)가 만들어지고, 앱 파일 전체(sql.js WASM 포함)를 미리 저장해 둔다.
    // 새 버전을 배포하면 다음 실행 때 자동으로 바뀐다(autoUpdate).
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon-32x32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'SQLD 문제은행',
        short_name: 'SQLD',
        description: 'SQLD 시험 대비 개인용 문제은행·모의고사',
        lang: 'ko',
        theme_color: '#3a6ea5',
        background_color: '#f6f7f9',
        display: 'standalone',
        // 상대 경로: GitHub Pages처럼 하위 경로에 배포해도 그대로 동작
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 오프라인에서 필요한 모든 파일 — wasm(sql.js)을 꼭 포함한다
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,ico,webmanifest}'],
        // 문제 데이터·sql.js가 기본 한도(2MB)에 가까워질 수 있어 넉넉히
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    // 문제 데이터 묶음(약 1.2MB, gzip 약 0.3MB)은 한 번 받으면 PWA가 캐시하는 데이터라 경고 기준을 넉넉히 둔다
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // 문제 데이터는 따로 묶는다 — 앱 코드와 나눠 캐시된다
          groups: [{ name: 'questions', test: /src[\\/]data[\\/]questions/ }],
        },
      },
    },
  },
  test: {
    // 브라우저 API(DOM, IndexedDB)를 쓰는 테스트가 많으므로 jsdom 환경
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
})
