import { describe, it, expect } from 'vitest'
import { fixedRef, isGenerated, parseRef, refOf, templateRef } from '../src/domain'
import type { GeneratedQuestion, Question } from '../src/domain'

// docs/04 §5의 예시 JSON이 Question 타입에 그대로 맞는지 (맞지 않으면 빌드에서 타입 오류)
const docExample = {
  id: 'S1-05-0003',
  subject: 2,
  chapter: 'S1-05',
  topic: 'COUNT(*)와 COUNT(컬럼)의 차이',
  type: 'sql_result',
  difficulty: 2,
  stem: '다음 [EMP] 테이블에 SQL을 실행했을 때 결과로 알맞은 것은?',
  tables: [
    {
      name: 'EMP',
      columns: ['EMPNO', 'DEPT', 'BONUS'],
      rows: [
        [1, 'A', 100],
        [2, 'A', null],
      ],
    },
  ],
  sql: 'SELECT DEPT, COUNT(*) AS C1, COUNT(BONUS) AS C2\nFROM EMP\nGROUP BY DEPT;',
  choices: ['A:2,1 / B:3,2', 'A:2,2 / B:3,3', 'A:1,1 / B:2,2', 'A:2,1 / B:3,3'],
  answer: 1,
  fixedOrder: false,
  explanation: '정답은 ①입니다.',
  examPoint: '집계 함수는 NULL을 무시하지만 COUNT(*)만은 예외다.',
  tags: ['NULL', '집계함수'],
  source: 'claude',
  verify: { executable: true },
} satisfies Question

const generated: GeneratedQuestion = {
  templateId: 'TP02',
  seed: 4821,
  subject: 2,
  chapter: 'S1-03',
  topic: 'NULL과 집계',
  type: 'sql_result',
  difficulty: 2,
  stem: '결과 값은?',
  choices: ['1', '2', '3', '4'],
  answer: 3,
  explanation: '해설',
  examPoint: '포인트',
}

describe('T2-1 도메인 타입', () => {
  it('고정 문제와 템플릿 문제를 구분한다', () => {
    expect(isGenerated(docExample)).toBe(false)
    expect(isGenerated(generated)).toBe(true)
  })

  it('문제 키를 만들고 다시 풀 수 있다', () => {
    expect(refOf(docExample)).toBe('S1-05-0003')
    expect(refOf(generated)).toBe('TP02#4821')

    expect(parseRef(fixedRef('U-S1-05-0001'))).toEqual({ kind: 'fixed', questionId: 'U-S1-05-0001' })
    expect(parseRef(templateRef('TP02', 4821))).toEqual({
      kind: 'template',
      templateId: 'TP02',
      seed: 4821,
    })
  })

  it('망가진 템플릿 키는 오류를 낸다', () => {
    expect(() => parseRef('TP02#abc')).toThrow('잘못된 문제 키')
    expect(() => parseRef('#12')).toThrow('잘못된 문제 키')
  })
})
