/**
 * 문제 검색 (T7-1)
 * 본문·주제·태그·문제 ID·SQL에서 찾는다. 띄어쓰기로 나눈 낱말이 "모두" 들어 있는 문제만 남긴다.
 * 대소문자는 구분하지 않는다 (SQL 키워드를 소문자로 쳐도 찾히게).
 */
import type { Question } from './types'

function haystack(q: Question): string {
  return [q.id, q.topic, q.stem, q.sql ?? '', ...(q.tags ?? [])].join('\n').toLowerCase()
}

export function searchQuestions(questions: readonly Question[], query: string): Question[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...questions]
  return questions.filter((q) => {
    const text = haystack(q)
    return words.every((w) => text.includes(w))
  })
}
