import {
  buildWrongNote,
  emptyNote,
  type AnyQuestion,
  type Note,
  type Question,
  type QuestionRef,
  type WrongNoteEntry,
} from '../../domain'
import { getStorage } from '../../storage'
import { loadAllQuestions, loadSessionQuestions, questionInfoResolver } from '../Practice/loadQuestions'

export interface LoadedWrongNote {
  entries: WrongNoteEntry[]
  /** 고정 문제 (자세히 보기에서 문제를 찾을 때) */
  questions: Question[]
}

/**
 * 오답노트 목록 불러오기 (T6-1)
 */
export async function loadWrongNote(): Promise<LoadedWrongNote> {
  const storage = getStorage()
  const [questions, attempts, notes] = await Promise.all([
    loadAllQuestions(),
    storage.listAttempts(),
    storage.listNotes(),
  ])
  return { entries: buildWrongNote(attempts, notes, questionInfoResolver(questions)), questions }
}

/** 문제 하나 불러오기 — 변형 문제는 같은 시드로 다시 만든다 (자세히 보기용, T6-2) */
export async function loadQuestion(ref: QuestionRef, fixed: readonly Question[]): Promise<AnyQuestion | undefined> {
  return (await loadSessionQuestions([ref], fixed)).get(ref)
}

/** 오답노트 상태 바꾸기 — 저장된 Note(없으면 빈 Note)에 change를 적용해 저장하고 돌려준다 (T6-2) */
export async function updateNote(ref: QuestionRef, change: (note: Note) => Note): Promise<Note> {
  const storage = getStorage()
  const next = change((await storage.getNote(ref)) ?? emptyNote(ref))
  await storage.putNote(next)
  return next
}

/** "2026-11-03T10:05:00Z" → "11월 3일" (올해가 아니면 "2025년 11월 3일") */
export function formatDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}년 ${md}`
}
