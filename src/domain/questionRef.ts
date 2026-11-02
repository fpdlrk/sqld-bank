import type { AnyQuestion, QuestionRef } from './types'
import { isGenerated } from './types'

/**
 * 문제를 가리키는 문자열 키(QuestionRef) 만들기·해석하기
 *
 * 고정 문제는 ID 그대로, 템플릿 문제는 "템플릿ID#시드".
 * 하나의 문자열이라 IndexedDB 인덱스·오답노트 키로 바로 쓸 수 있다.
 * 고정 문제 ID에는 '#'이 들어가지 않으므로 둘이 섞일 일이 없다.
 */
const SEPARATOR = '#'

export function fixedRef(questionId: string): QuestionRef {
  return questionId
}

export function templateRef(templateId: string, seed: number): QuestionRef {
  return `${templateId}${SEPARATOR}${seed}`
}

/** 문제 객체에서 바로 키 만들기 */
export function refOf(q: AnyQuestion): QuestionRef {
  return isGenerated(q) ? templateRef(q.templateId, q.seed) : fixedRef(q.id)
}

export type ParsedRef =
  | { kind: 'fixed'; questionId: string }
  | { kind: 'template'; templateId: string; seed: number }

/** 키를 다시 풀어서 고정 문제인지 템플릿 문제인지 알려 준다 */
export function parseRef(ref: QuestionRef): ParsedRef {
  const at = ref.lastIndexOf(SEPARATOR)
  if (at === -1) return { kind: 'fixed', questionId: ref }

  const templateId = ref.slice(0, at)
  const seed = Number(ref.slice(at + 1))
  if (!templateId || !Number.isInteger(seed)) {
    throw new Error(`잘못된 문제 키입니다: "${ref}"`)
  }
  return { kind: 'template', templateId, seed }
}
