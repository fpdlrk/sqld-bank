/**
 * 보기 섞기 (T3-5)
 *
 * 보기 순서 = 원래 번호의 배열. 예) [3, 1, 4, 2] → 화면 ①에 원래 ③, ②에 원래 ①…
 * 채점·기록은 항상 원래 번호로 하므로 순서를 섞어도 정답 판정은 바뀌지 않는다.
 * 순서는 회차(session.progress.choiceOrders)에 저장해 새로고침해도 같은 순서로 보인다.
 */
import { CHOICE_MARKS } from './labels'
import { shuffled } from './practice'
import type { ChoiceNumber, QuestionContent } from './types'

export const ORIGINAL_ORDER: readonly ChoiceNumber[] = [1, 2, 3, 4]

/** 이 문제의 보기 순서 정하기. fixedOrder 문제는 항상 원래 순서 */
export function makeChoiceOrder(
  question: Pick<QuestionContent, 'fixedOrder'>,
  random: () => number = Math.random,
): ChoiceNumber[] {
  return question.fixedOrder ? [...ORIGINAL_ORDER] : shuffled(ORIGINAL_ORDER, random)
}

/** 1~4가 한 번씩 들어 있는 올바른 순서인지 (저장된 값이 깨졌을 때 대비) */
export function isValidChoiceOrder(order: unknown): order is ChoiceNumber[] {
  return (
    Array.isArray(order) &&
    order.length === 4 &&
    ORIGINAL_ORDER.every((n) => order.includes(n))
  )
}

const MARK_TO_NO: Record<string, ChoiceNumber> = { '①': 1, '②': 2, '③': 3, '④': 4 }

/**
 * 글 속 ①~④(원래 번호)를 화면에 보이는 번호로 바꾼다.
 * 해설은 원래 번호로 쓰여 있으므로, 보기를 섞었으면 이 함수를 거쳐 보여 준다.
 * (docs/04 §4: ①~④ 기호는 보기 번호에만 쓴다)
 */
export function remapChoiceMarks(text: string, order: readonly ChoiceNumber[]): string {
  if (!isValidChoiceOrder(order)) return text
  return text.replace(/[①②③④]/g, (mark) => {
    const original = MARK_TO_NO[mark] as ChoiceNumber
    return CHOICE_MARKS[(order.indexOf(original) + 1) as ChoiceNumber]
  })
}
