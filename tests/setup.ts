// 모든 테스트 전에 한 번 실행되는 공통 설정.
import '@testing-library/jest-dom/vitest'

// IndexedDB 어댑터 테스트(T2-6)용. jsdom에는 IndexedDB가 없어 가짜 구현을 끼운다.
import 'fake-indexeddb/auto'
