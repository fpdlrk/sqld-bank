import { describe, it, expect } from 'vitest'
import {
  CHAPTERS,
  CHAPTER_CODES,
  PARTS,
  SUBJECTS,
  chapterLabel,
  chaptersOfPart,
  chaptersOfSubject,
  isChapterCode,
  partOf,
} from '../src/domain'

const sumWeight = (subject: 1 | 2) =>
  chaptersOfSubject(subject).reduce((sum, c) => sum + c.examWeight, 0)

describe('T2-2 단원 코드표', () => {
  it('단원은 1과목 10개 + 2과목 20개 = 30개이고 코드가 겹치지 않는다', () => {
    expect(chaptersOfSubject(1)).toHaveLength(10)
    expect(chaptersOfSubject(2)).toHaveLength(20)
    expect(new Set(CHAPTER_CODES).size).toBe(CHAPTERS.length)
  })

  it('코드 형식은 "파트-두 자리 번호"이고, 파트의 과목과 단원의 과목이 같다', () => {
    for (const c of CHAPTERS) {
      expect(c.code).toMatch(/^(M1|M2|S1|S2|S3)-\d{2}$/)
      expect(partOf(c.code).subject).toBe(c.subject)
    }
  })

  it('2과목 모의고사 비중 합계 = 40 (과목 문항 수와 같음)', () => {
    expect(sumWeight(2)).toBe(SUBJECTS.find((s) => s.subject === 2)?.examCount)
    expect(chaptersOfSubject(2).some((c) => 'optional' in c)).toBe(false)
  })

  it('1과목은 고정 9 + optional 단원 중 1문항 = 10', () => {
    const optional = chaptersOfSubject(1).filter((c) => c.optional)
    expect(sumWeight(1)).toBe(9)
    expect(optional.map((c) => c.code)).toEqual(['M2-03', 'M2-04', 'M2-05'])
    expect(optional.every((c) => c.examWeight === 0)).toBe(true)
    expect(sumWeight(1) + 1).toBe(SUBJECTS.find((s) => s.subject === 1)?.examCount)
  })

  it('파트 5개가 모든 단원을 빠짐없이 나눠 가진다', () => {
    const total = PARTS.reduce((n, p) => n + chaptersOfPart(p.code).length, 0)
    expect(total).toBe(CHAPTERS.length)
  })

  it('조회 함수', () => {
    expect(isChapterCode('S1-05')).toBe(true)
    expect(isChapterCode('S1-99')).toBe(false)
    expect(chapterLabel('S1-05')).toBe('S1-05 GROUP BY, HAVING절')
    expect(partOf('S3-02').label).toBe('2과목 C')
  })
})
