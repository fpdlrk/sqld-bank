import { describe, it, expect } from 'vitest'
import { remapChoiceMarks, type ChoiceNumber } from '../src/domain'

// 화면 순서 [3, 1, 4, 2]: 원래 ③이 화면 ①, 원래 ①이 화면 ②, 원래 ④가 화면 ③, 원래 ②가 화면 ④
const order: ChoiceNumber[] = [3, 1, 4, 2]

describe('보기 번호 바꾸기와 조사', () => {
  it('번호가 바뀌면 뒤 조사도 받침에 맞게 바뀐다', () => {
    expect(remapChoiceMarks('①은 틀렸고, ②는 맞습니다.', order)).toBe('②는 틀렸고, ④는 맞습니다.')
    expect(remapChoiceMarks('③이 정답이며 ④를 고르면 안 됩니다.', order)).toBe('①이 정답이며 ③을 고르면 안 됩니다.')
    expect(remapChoiceMarks('①과 ②', order)).toBe('②와 ④')
  })

  it('조사가 없거나 괄호가 붙어도 번호만 바뀐다', () => {
    expect(remapChoiceMarks('정답은 ③(750, 1050)입니다. ①·②·④', order)).toBe('정답은 ①(750, 1050)입니다. ②·④·③')
  })

  it('조사가 아닌 낱말이 이어지면 건드리지 않는다', () => {
    expect(remapChoiceMarks('②이라고 볼 수 있다', order)).toBe('④이라고 볼 수 있다')
  })

  it('원래 순서면 그대로', () => {
    expect(remapChoiceMarks('①은 ②는', [1, 2, 3, 4])).toBe('①은 ②는')
  })
})
