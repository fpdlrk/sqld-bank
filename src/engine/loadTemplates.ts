/**
 * 템플릿 코드 나눠 불러오기 (T4-7)
 * import()로 불러오면 Vite가 템플릿 코드를 별도 파일로 떼어 내, 변형 문제가 필요할 때만 받는다.
 */
import type { GeneratedQuestion, QuestionTemplate } from '../domain'

let cache: Promise<readonly QuestionTemplate[]> | undefined

export function loadTemplates(): Promise<readonly QuestionTemplate[]> {
  cache ??= import('./templates').then(
    (m) => m.TEMPLATES,
    (err: unknown) => {
      cache = undefined // 실패하면 다음에 다시 시도
      throw err
    },
  )
  return cache
}

/** 템플릿 ID + 시드 → 문제. 없는 템플릿이면 undefined */
export async function generateTemplateQuestion(templateId: string, seed: number): Promise<GeneratedQuestion | undefined> {
  const template = (await loadTemplates()).find((t) => t.id === templateId)
  return template?.generate(seed)
}
