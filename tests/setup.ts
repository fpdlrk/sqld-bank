// 모든 테스트 전에 한 번 실행되는 공통 설정.
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// IndexedDB 어댑터 테스트(T2-6)용. jsdom에는 IndexedDB가 없어 가짜 구현을 끼운다.
import 'fake-indexeddb/auto'

/**
 * 화면·출제·통계 테스트는 "샘플 문제 12개"를 기준으로 작성했다 (T2-4).
 * 문제 콘텐츠가 늘어나도(Phase 8) 이 테스트들의 기대값이 흔들리지 않도록,
 * 앱이 쓰는 기본 문제 목록을 샘플 12개로 고정한다.
 *
 * 문제 콘텐츠 자체의 검사(questions·questions-sql·questionContent 테스트)는
 * JSON 파일을 직접 읽으므로 전체 문제를 그대로 검사한다.
 */
vi.mock('../src/data/builtInQuestions', async (importOriginal) => {
  const { SAMPLE_QUESTION_IDS } = await import('./helpers/sampleBank')
  const original = await importOriginal<typeof import('../src/data/builtInQuestions')>()
  return {
    ...original,
    BUILT_IN_QUESTIONS: original.BUILT_IN_QUESTIONS.filter((q) => SAMPLE_QUESTION_IDS.has(q.id)),
  }
})
