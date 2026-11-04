/**
 * 직접 추가 문제 JSON 내보내기 (T7-3)
 * 가져오기(questionImport.ts)는 이 형식과 docs/04 형식의 "문제 배열"을 모두 받는다.
 */
import type { UserQuestion } from './types'

export const QUESTIONS_FILE_FORMAT = 'sqld-bank/questions'
export const QUESTIONS_FILE_VERSION = 1

export interface QuestionsFile {
  format: typeof QUESTIONS_FILE_FORMAT
  version: number
  exportedAt: string
  questions: UserQuestion[]
}

export function buildQuestionsFile(questions: readonly UserQuestion[], now: Date = new Date()): QuestionsFile {
  return {
    format: QUESTIONS_FILE_FORMAT,
    version: QUESTIONS_FILE_VERSION,
    exportedAt: now.toISOString(),
    questions: [...questions].sort((a, b) => (a.id < b.id ? -1 : 1)),
  }
}

/** 파일 이름에 넣을 날짜 "20261104" (현지 날짜) */
export function fileDate(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
}
