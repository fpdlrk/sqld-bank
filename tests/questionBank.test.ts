import { describe, it, expect } from 'vitest'
import { BUILT_IN_QUESTIONS } from '../src/data/builtInQuestions'
import { countByChapter, filterQuestions, findQuestion, mergeQuestions } from '../src/domain'
import type { Question } from '../src/domain'

const builtIn = [...BUILT_IN_QUESTIONS]

// 직접 추가 문제 예시 (기본 문제 하나를 복사해 ID·출처만 바꿈)
const base = findQuestion(builtIn, 'S1-05-0001')!
const userQ: Question = { ...base, id: 'U-S1-05-0001', source: 'user', difficulty: 3 }

describe('T2-5 기본 문제 불러오기', () => {
  it('src/data/questions/*.json 의 문제를 모두 불러온다 (T2-4 샘플 12개 이상)', () => {
    expect(builtIn.length).toBeGreaterThanOrEqual(12)
    expect(findQuestion(builtIn, 'S3-02-0001')?.type).toBe('scenario')
  })
})

describe('T2-5 합치기', () => {
  it('기본 + 직접 추가 문제를 ID 순으로 합치고, 직접 추가 문제는 뒤에 둔다', () => {
    const { questions, skippedIds } = mergeQuestions(builtIn, [userQ])
    expect(questions).toHaveLength(builtIn.length + 1)
    expect(questions[0]?.id).toBe('M1-01-0001')
    expect(questions.at(-1)?.id).toBe('U-S1-05-0001')
    expect(skippedIds).toEqual([])
  })

  it('ID가 겹치면 기본 문제를 남기고 겹친 ID를 알려 준다', () => {
    const clash: Question = { ...userQ, id: 'S1-05-0001' }
    const { questions, skippedIds } = mergeQuestions(builtIn, [clash])
    expect(questions).toHaveLength(builtIn.length)
    expect(findQuestion(questions, 'S1-05-0001')?.source).toBe('claude')
    expect(skippedIds).toEqual(['S1-05-0001'])
  })
})

describe('T2-5 거르기', () => {
  const { questions } = mergeQuestions(builtIn, [userQ])

  it('조건이 없으면 전체', () => {
    expect(filterQuestions(questions)).toHaveLength(questions.length)
    expect(filterQuestions(questions, { subjects: [], types: [] })).toHaveLength(questions.length)
  })

  it('과목', () => {
    const s1 = filterQuestions(questions, { subjects: [1] })
    expect(s1.length).toBeGreaterThan(0)
    expect(s1.every((q) => q.subject === 1)).toBe(true)
  })

  it('단원 여러 개 (하나라도 맞으면 통과)', () => {
    const ids = filterQuestions(questions, { chapters: ['S1-04', 'S1-08'] }).map((q) => q.id)
    expect(ids).toEqual(['S1-04-0001', 'S1-08-0001'])
  })

  it('조건 여러 개는 모두 만족해야 한다', () => {
    const r = filterQuestions(questions, { subjects: [2], types: ['sql_result'], difficulties: [3] })
    expect(r.map((q) => q.id)).toEqual(['S1-08-0001'])
  })

  it('출처', () => {
    expect(filterQuestions(questions, { sources: ['user'] }).map((q) => q.id)).toEqual(['U-S1-05-0001'])
  })

  it('단원별 문제 수', () => {
    const counts = countByChapter(questions)
    expect(counts.get('S1-05')).toBe(2) // 기본 1 + 직접 추가 1
    expect(counts.get('M1-02')).toBeUndefined()
  })
})
