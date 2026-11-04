/**
 * 문제 JSON 가져오기 (T7-3)
 *
 * 받는 형식: 이 앱이 내보낸 파일({ format, questions: [...] }) 또는 문제 배열(docs/04 §5, 기본 문제 파일 그대로)
 * - 문제마다 스키마로 검사 → 틀린 문제는 이유와 함께 건너뜀
 * - 가져온 문제는 모두 "직접 추가"(source: user)로 저장. ID가 "U-{단원}-" 형식이 아니면 새 번호
 * - ID가 겹치면(기존 직접 추가 문제 또는 파일 안) 선택에 따라: 새 번호로 추가 / 덮어쓰기 / 건너뛰기
 *
 * ⚠ 스키마 검사(zod)를 쓰므로 domain/index.ts에서 내보내지 않는다 — 가져오기 화면에서 직접 import.
 */
import { CHAPTER_CODES } from './chapters'
import { nextUserQuestionId } from './questionDraft'
import { validateQuestion, type FieldProblem } from './questionSchema'
import type { ChapterCode, UserQuestion } from './types'

export type ConflictMode = 'renumber' | 'overwrite' | 'skip'

export interface InvalidItem {
  /** 파일 안에서 몇 번째 (1부터) */
  index: number
  id: string | null
  problems: FieldProblem[]
}

export interface ImportPlan {
  /** 저장할 문제 (ID 정리 끝) */
  ready: UserQuestion[]
  invalid: InvalidItem[]
  /** ID가 겹친 문제 수 (처리 방식과 상관없이) */
  conflicts: number
  /** 새 번호를 붙인 문제 수 */
  renumbered: number
  /** 덮어쓸 문제 수 */
  overwritten: number
  /** 건너뛴 문제 수 (ID 겹침 + 건너뛰기) */
  skipped: number
  /** 파일 안의 문제 수 */
  total: number
}

export type ParseResult = { ok: true; items: unknown[] } | { ok: false; message: string }

/** 파일 글자 → 문제 목록 */
export function parseQuestionsFile(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, message: 'JSON 형식이 아닙니다. 파일 내용을 확인해 주세요.' }
  }
  if (Array.isArray(data)) return { ok: true, items: data }
  if (typeof data === 'object' && data !== null && Array.isArray((data as { questions?: unknown }).questions)) {
    return { ok: true, items: (data as { questions: unknown[] }).questions }
  }
  return { ok: false, message: '문제 목록을 찾을 수 없습니다. 문제 배열이나 이 앱에서 내보낸 파일이어야 합니다.' }
}

const isChapter = (v: unknown): v is ChapterCode => typeof v === 'string' && (CHAPTER_CODES as string[]).includes(v)
const ownId = (id: unknown, chapter: ChapterCode) =>
  typeof id === 'string' && new RegExp(`^U-${chapter}-\\d{4}$`).test(id)

export function planImport(
  items: readonly unknown[],
  existingIds: readonly string[],
  mode: ConflictMode = 'renumber',
  now: Date = new Date(),
): ImportPlan {
  const existing = new Set(existingIds)
  // 새 번호를 매길 때 피할 ID — 기존 문제 + 파일 안에서 그대로 쓸 "U-" ID를 미리 잡아 둔다
  // (앞 문제에 새 번호를 붙였는데 뒤 문제가 같은 번호를 갖고 있으면 서로 덮어쓰게 되므로)
  const used = new Set(existingIds)
  for (const raw of items) {
    const id = (raw as { id?: unknown } | null)?.id
    if (typeof id === 'string' && /^U-(M1|M2|S1|S2|S3)-\d{2}-\d{4}$/.test(id)) used.add(id)
  }
  const ready: UserQuestion[] = []
  const invalid: InvalidItem[] = []
  let conflicts = 0
  let renumbered = 0
  let overwritten = 0
  let skipped = 0
  /** 이 가져오기에서 실제로 쓰기로 정한 ID */
  const assigned = new Set<string>()

  items.forEach((raw, i) => {
    const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
    const rawId = typeof obj.id === 'string' ? obj.id : null
    const { createdAt, updatedAt: _u, ...rest } = obj
    const chapter = isChapter(obj.chapter) ? obj.chapter : null

    // 검사용 ID: 직접 추가 형식이 아니면 임시 번호 (검사가 끝나면 진짜 번호로 바꾼다)
    const keepId = chapter !== null && ownId(rawId, chapter)
    const candidateId = keepId ? rawId : chapter ? `U-${chapter}-0000` : rawId
    const result = validateQuestion({ ...rest, id: candidateId, source: 'user' })
    if (!result.ok) {
      invalid.push({ index: i + 1, id: rawId, problems: result.problems })
      return
    }

    let id = result.question.id
    const conflict = keepId && (existing.has(id) || assigned.has(id))
    if (conflict) {
      conflicts++
      if (mode === 'skip') {
        skipped++
        return
      }
      if (mode === 'overwrite' && !assigned.has(id)) overwritten++
      else id = '' // 새 번호 (파일 안 중복은 덮어쓰기여도 새 번호 — 같은 파일의 두 문제를 모두 살린다)
    }
    if (!keepId || id === '') {
      id = nextUserQuestionId([...used], result.question.chapter)
      renumbered++
    }
    used.add(id)
    assigned.add(id)

    const stamp = now.toISOString()
    ready.push({
      ...result.question,
      id,
      source: 'user',
      createdAt: typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt)) ? createdAt : stamp,
      updatedAt: stamp,
    })
  })

  return { ready, invalid, conflicts, renumbered, overwritten, skipped, total: items.length }
}
