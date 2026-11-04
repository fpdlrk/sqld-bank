import { z } from 'zod'
import { CHAPTER_CODES, getChapter } from './chapters'
import type { ChoiceTexts, Question } from './types'

/**
 * 문제 JSON 스키마 검증 (T2-3) — 규칙은 docs/04 §5
 *
 * 쓰는 곳: 고정 문제 테스트, 직접 추가 폼(T7-2), JSON 가져오기(T7-3)
 * 오류 메시지는 한국어로 나온다 (zod 내장 한국어 메시지 + 아래 직접 쓴 메시지).
 */
z.config(z.locales.ko())

const nonEmpty = (what: string) => z.string().trim().min(1, { error: `${what}이(가) 비어 있습니다` })

const cellSchema = z.union([z.string(), z.number(), z.null()])

const tableSchema = z
  .strictObject({
    name: z.optional(nonEmpty('테이블 이름')),
    columns: z.array(nonEmpty('컬럼 이름')).min(1, { error: '컬럼이 1개 이상 있어야 합니다' }),
    rows: z.array(z.array(cellSchema)),
  })
  .superRefine((t, ctx) => {
    if (!Array.isArray(t.columns) || !Array.isArray(t.rows)) return
    if (new Set(t.columns).size !== t.columns.length) {
      ctx.addIssue({ code: 'custom', path: ['columns'], message: '컬럼 이름이 중복됩니다' })
    }
    t.rows.forEach((row, i) => {
      if (Array.isArray(row) && row.length !== t.columns.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['rows', i],
          message: `${i + 1}번째 행의 값 개수(${row.length})가 컬럼 수(${t.columns.length})와 다릅니다`,
        })
      }
    })
  })

const choiceNumber = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)], {
  error: '정답은 1~4 중 하나여야 합니다',
})

export const questionSchema = z
  .strictObject({
    id: z.string().regex(/^(U-)?(M1|M2|S1|S2|S3)-\d{2}-\d{4}$/, {
      error: 'ID 형식은 "S1-05-0003" (직접 추가는 "U-S1-05-0003") 이어야 합니다',
    }),
    subject: z.union([z.literal(1), z.literal(2)], { error: '과목은 1 또는 2여야 합니다' }),
    chapter: z.enum(CHAPTER_CODES, { error: 'docs/04 §2 단원 코드표에 없는 코드입니다' }),
    topic: nonEmpty('세부 주제(topic)').max(40, { error: '세부 주제는 40자 이내로 써 주세요' }),
    type: z.enum(
      ['concept', 'sql_result', 'sql_error', 'sql_equivalent', 'sql_fill', 'modeling', 'scenario'],
      { error: '유형은 docs/04 §3의 7가지 중 하나여야 합니다' },
    ),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)], {
      error: '난이도는 1~3이어야 합니다',
    }),
    stem: nonEmpty('문제 본문(stem)'),
    tables: z.optional(z.array(tableSchema)),
    sql: z.optional(nonEmpty('sql')),
    sqlExec: z.optional(nonEmpty('sqlExec')),
    // tuple 대신 array + length(4): 개수가 틀렸을 때 "보기는 정확히 4개" 메시지를 내기 위해
    choices: z
      .array(nonEmpty('보기'))
      .length(4, { error: '보기는 정확히 4개여야 합니다' })
      .refine((c) => new Set(c.map((s) => s.trim())).size === c.length, {
        error: '보기 4개가 서로 달라야 합니다',
      })
      .transform((c) => c as ChoiceTexts),
    answer: choiceNumber,
    fixedOrder: z.optional(z.boolean()),
    explanation: nonEmpty('해설(explanation)'),
    examPoint: nonEmpty('시험 포인트(examPoint)'),
    tags: z.optional(z.array(nonEmpty('태그'))),
    source: z.enum(['claude', 'user'], { error: '출처는 "claude" 또는 "user"여야 합니다' }),
    verify: z.optional(
      z.strictObject({
        executable: z.boolean(),
        expect: z.optional(z.enum(['rowCount', 'value', 'resultTable'])),
      }),
    ),
  })
  .superRefine((q, ctx) => {
    // 여러 필드가 서로 맞아야 하는 규칙. 앞 단계에서 형식이 틀렸을 수 있으므로 하나씩 확인 후 검사.
    const chapterOk = typeof q.chapter === 'string' && (CHAPTER_CODES as string[]).includes(q.chapter)

    if (chapterOk && typeof q.subject === 'number' && getChapter(q.chapter).subject !== q.subject) {
      ctx.addIssue({
        code: 'custom',
        path: ['subject'],
        message: `단원 ${q.chapter}은(는) ${getChapter(q.chapter).subject}과목입니다`,
      })
    }

    if (chapterOk && typeof q.id === 'string') {
      const prefix = q.source === 'user' ? `U-${q.chapter}-` : `${q.chapter}-`
      if (!q.id.startsWith(prefix)) {
        ctx.addIssue({
          code: 'custom',
          path: ['id'],
          message: `ID는 "${prefix}"로 시작해야 합니다 (단원·출처와 일치)`,
        })
      }
    }

    if (q.verify?.executable && !q.sql && !q.sqlExec) {
      ctx.addIssue({
        code: 'custom',
        path: ['verify'],
        message: 'verify.executable이 true면 sql 또는 sqlExec가 있어야 합니다',
      })
    }
    // when: 다른 필드에 오류가 있어도 이 검사를 건너뛰지 않게 (오류를 한 번에 다 보여 주기 위해)
  }, { when: () => true })

// ── 스키마와 Question 타입이 서로 어긋나면 여기서 빌드 오류가 난다 (필드를 한쪽만 고친 경우 방지)
// zod는 선택 필드를 `T | undefined`로 내보내므로 비교할 때만 undefined를 걷어 낸다.
type NoUndefined<T> = T extends readonly unknown[]
  ? { [K in keyof T]: NoUndefined<T[K]> }
  : T extends object
    ? { [K in keyof T]: NoUndefined<Exclude<T[K], undefined>> }
    : T
const _schemaToType = (q: NoUndefined<z.output<typeof questionSchema>>): Question => q
const _typeToSchema = (q: Question): z.input<typeof questionSchema> => q
void _schemaToType
void _typeToSchema

// ───────────────────────────── 파일 묶음 검사 ─────────────────────────────

/** 검사에서 찾은 문제점 1개 */
export interface QuestionProblem {
  /** 파일 이름 (예: "S1-05.json") */
  file: string
  /** 파일 안에서 몇 번째 문제인지 (1부터). 파일 자체 오류면 null */
  index: number | null
  /** 문제 ID (읽을 수 있으면) */
  id: string | null
  /** 어느 필드인지 (예: "choices", "tables.0.rows.2") */
  path: string
  message: string
}

/** 사람이 읽기 좋은 한 줄로 */
export function formatProblem(p: QuestionProblem): string {
  const where = p.index === null ? '' : ` [${p.index}번째${p.id ? ` ${p.id}` : ''}]`
  const field = p.path ? ` ${p.path}:` : ''
  return `${p.file}${where}${field} ${p.message}`
}

/**
 * src/data/questions/*.json 전체 검사
 * @param files { "파일 경로": JSON 내용 } — import.meta.glob 결과 그대로 넣으면 된다
 *
 * 검사 내용: 문제 하나하나의 스키마 + 파일 이름 = 단원 코드 + 전체 ID 중복
 */
export function validateQuestionFiles(files: Record<string, unknown>): QuestionProblem[] {
  const problems: QuestionProblem[] = []
  const seenIds = new Map<string, string>() // id → 처음 나온 위치

  for (const [path, content] of Object.entries(files)) {
    const file = path.split('/').pop() ?? path
    const fileChapter = file.replace(/\.json$/, '')

    if (!(CHAPTER_CODES as string[]).includes(fileChapter)) {
      problems.push({
        file, index: null, id: null, path: '',
        message: `파일 이름은 단원 코드여야 합니다 (예: S1-05.json)`,
      })
    }
    if (!Array.isArray(content)) {
      problems.push({ file, index: null, id: null, path: '', message: '파일 내용은 문제 배열([...])이어야 합니다' })
      continue
    }

    content.forEach((raw: unknown, i) => {
      const index = i + 1
      const id =
        raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string' ? raw.id : null

      const result = questionSchema.safeParse(raw)
      if (!result.success) {
        for (const issue of result.error.issues) {
          problems.push({ file, index, id, path: issue.path.join('.'), message: issue.message })
        }
      }

      if (raw && typeof raw === 'object' && 'chapter' in raw && raw.chapter !== fileChapter) {
        problems.push({
          file, index, id, path: 'chapter',
          message: `단원 코드(${String(raw.chapter)})가 파일 이름(${fileChapter})과 다릅니다`,
        })
      }

      if (id) {
        const first = seenIds.get(id)
        if (first) {
          problems.push({ file, index, id, path: 'id', message: `ID가 중복됩니다 (처음 나온 곳: ${first})` })
        } else {
          seenIds.set(id, `${file} ${index}번째`)
        }
      }
    })
  }
  return problems
}

// ───────────────────────────── 문제 하나 검사 (직접 추가 폼, T7-2) ─────────────────────────────

/** 폼에서 보여 줄 문제점 (어느 칸인지 + 내용) */
export interface FieldProblem {
  /** 예: "choices", "tables.0.rows.2" (문제 전체에 대한 것이면 "") */
  path: string
  message: string
}

export type QuestionValidation = { ok: true; question: Question } | { ok: false; problems: FieldProblem[] }

/** 문제 하나를 스키마로 검사한다 (docs/04 §5). 직접 추가 문제의 createdAt·updatedAt은 빼고 넣는다. */
export function validateQuestion(raw: unknown): QuestionValidation {
  const result = questionSchema.safeParse(raw)
  if (result.success) return { ok: true, question: result.data as Question }
  return {
    ok: false,
    problems: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  }
}
