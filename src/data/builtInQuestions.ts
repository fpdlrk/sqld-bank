import type { Question } from '../domain'

/**
 * 기본 문제 불러오기 (T2-5)
 *
 * src/data/questions/*.json 을 빌드할 때 한꺼번에 앱에 넣는다 (Vite의 import.meta.glob).
 * 새 단원 파일을 추가해도 이 코드는 고칠 필요가 없다.
 *
 * JSON 내용이 규칙에 맞는지는 테스트(tests/questions.test.ts)가 미리 검사하므로
 * 여기서는 다시 검사하지 않는다 (앱 시작을 가볍게 하기 위해).
 */
const files = import.meta.glob<Question[]>('./questions/*.json', {
  eager: true,
  import: 'default',
})

export const BUILT_IN_QUESTIONS: readonly Question[] = Object.values(files).flat()
