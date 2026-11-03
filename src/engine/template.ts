/**
 * 템플릿 프레임워크 (T4-3) — docs/04 §7
 *
 * 템플릿 하나 = "데이터를 무작위로 만들고, 정답 쿼리와 함정 쿼리(흔한 실수)를 실제로 실행해 보기를 만드는 규칙".
 *
 * 생성 순서 (generate):
 *   1) build(rng)로 예시 테이블·본문·SQL·정답/함정 쿼리를 만든다
 *   2) 쿼리마다 새 DB에서 실행한다 (DML 시나리오가 서로 섞이지 않도록)
 *   3) 정답과 같거나 서로 겹치는 함정 보기는 버린다
 *      → 진짜 함정이 minTraps개보다 적으면 데이터를 다시 만든다 (최대 20회)
 *   4) 모자란 자리는 fillers(보충 후보)로 채운다
 *   5) 보기 배치: 건수·숫자처럼 크기 순인 보기는 오름차순 고정, 아니면 섞는다
 *   6) 해설 = 첫 문단 + 실행 결과 표 + 오답 보기별 "어떤 착각인지"
 * 같은 시드 → 같은 문제 (모든 무작위는 rng를 거친다).
 */
import {
  CHOICE_MARKS,
  type CellValue,
  type ChapterCode,
  type ChoiceNumber,
  type ChoiceTexts,
  type Difficulty,
  type GeneratedQuestion,
  type QuestionTemplate,
  type QuestionType,
  type Subject,
  type TableData,
} from '../domain'
import { createRng, type Rng } from './rng'
import { withDatabase } from './sqlRunner'

// ───────────────────────────── 정의 형식 ─────────────────────────────

/** 실행해서 보기 글자를 얻는 쿼리 */
export interface SqlProbe {
  /** sql.js(SQLite)로 실행할 SQL. 여러 문장이면 마지막 결과를 쓴다 */
  sql: string
  /** 결과 표 → 보기 글자 (기본: format.value) */
  format?: (result: TableData) => string
}

/** 함정 보기 하나 — SQL로 계산하거나(sql) 글자를 바로 주거나(text) */
export type TrapProbe = (SqlProbe | { text: string }) & {
  /** 이 보기가 노리는 착각 — 해설에 "①은 {why} 경우의 결과입니다"로 들어간다 */
  why: string
}

/** build가 한 번 만들어 내는 문제 재료 */
export interface TemplateScenario {
  /** 예시 테이블 (화면 표시 + 실행용 테이블 생성) */
  tables: TableData[]
  /** 실행용으로만 쓰는 추가 테이블 (화면에는 안 보임) */
  hiddenTables?: TableData[]
  stem: string
  /** 화면에 보여 줄 SQL (Oracle 문법) */
  sql?: string
  answer: SqlProbe
  traps: TrapProbe[]
  /** 함정이 모자랄 때 쓸 보충 후보 (앞에서부터 사용, 정답·다른 보기와 겹치면 건너뜀) */
  fillers?: string[] | ((answerText: string) => string[])
  /** 해설에 넣을 중간 단계 표 (예: "WHERE 적용 후") — 실행 결과 표 앞에 차례로 들어간다 */
  steps?: { label: string; sql: string }[]
  /** 해설 첫 문단 — 정답과 핵심 이유. answerText는 정답 보기 글자 */
  explain: (ctx: ExplainContext) => string
  examPoint: string
}

export interface ExplainContext {
  answerText: string
  answerMark: string
  answerResult: TableData
}

export interface TemplateSpec {
  id: string
  subject: Subject
  chapter: ChapterCode
  topic: string
  type: QuestionType
  difficulty: Difficulty
  tags?: string[]
  /** 보기가 크기 순인 숫자(건수·값)면 true → 오름차순 고정 */
  numericChoices?: boolean
  /** 실제 함정(SQL로 계산된 서로 다른 오답)이 최소 몇 개 있어야 하는지 (기본 2) */
  minTraps?: number
  build: (rng: Rng) => TemplateScenario
}

// ───────────────────────────── 보기 글자 도우미 ─────────────────────────────

const cellText = (v: CellValue) => (v === null ? 'NULL' : String(v))

export const format = {
  /** 결과 행 수 → "3건" */
  count: (r: TableData) => `${r.rows.length}건`,
  /** 첫 행 첫 칸 → "1500" (NULL은 "NULL") */
  scalar: (r: TableData) => cellText(r.rows[0]?.[0] ?? null),
  /** 첫 행 전체 → "750, 1050, NULL" */
  value: (r: TableData) => (r.rows[0] ?? []).map(cellText).join(', '),
  /** 숫자 n → "n건" (fillers 만들 때) */
  countOf: (n: number) => `${n}건`,
}

/** 결과 표 → Markdown 표 (해설용). 0행이면 "(결과 없음)" 줄 */
export function tableToMarkdown(t: TableData): string {
  const head = `| ${t.columns.join(' | ')} |`
  const sep = `|${t.columns.map(() => '---').join('|')}|`
  const body = t.rows.length === 0 ? [`| ${t.columns.map((_, i) => (i === 0 ? '(결과 없음)' : '')).join(' | ')} |`] : t.rows.map((r) => `| ${r.map(cellText).join(' | ')} |`)
  return [head, sep, ...body].join('\n')
}

/** 보기 글자 속 첫 숫자 (크기 순 정렬용) */
function firstNumber(text: string): number {
  const m = /-?\d+(\.\d+)?/.exec(text)
  return m ? Number(m[0]) : Number.NaN
}

// ───────────────────────────── 생성 ─────────────────────────────

export const MAX_BUILD_TRIES = 20

async function runProbe(scenario: TemplateScenario, probe: SqlProbe): Promise<TableData> {
  const tables = [...scenario.tables, ...(scenario.hiddenTables ?? [])]
  return withDatabase(tables, (db) => db.query(probe.sql))
}

/** 중간 단계 표 → "**라벨**" + Markdown 표 문단들 */
async function runSteps(scenario: TemplateScenario): Promise<string[]> {
  const out: string[] = []
  for (const step of scenario.steps ?? []) {
    out.push(`**${step.label}**\n\n${tableToMarkdown(await runProbe(scenario, { sql: step.sql }))}`)
  }
  return out
}

interface Distractor {
  text: string
  why: string | null
}

export class TemplateError extends Error {}

/** 템플릿 정의 → 시드로 문제를 만드는 QuestionTemplate */
export function defineTemplate(spec: TemplateSpec): QuestionTemplate {
  const { build, numericChoices = false, minTraps = 2, tags, ...meta } = spec

  async function generate(seed: number): Promise<GeneratedQuestion> {
    const rng = createRng(seed)

    for (let attempt = 1; attempt <= MAX_BUILD_TRIES; attempt++) {
      const scenario = build(rng)
      const answerResult = await runProbe(scenario, scenario.answer)
      const answerText = (scenario.answer.format ?? format.value)(answerResult)

      // 함정 실행 → 정답과 같거나 이미 있는 글자는 버린다
      const distractors: Distractor[] = []
      const used = new Set([answerText])
      for (const trap of scenario.traps) {
        const text = 'text' in trap ? trap.text : (trap.format ?? format.value)(await runProbe(scenario, trap))
        if (used.has(text)) continue
        used.add(text)
        distractors.push({ text, why: trap.why })
      }
      if (distractors.length < minTraps) continue // 데이터가 함정을 드러내지 못함 → 다시 만들기

      const fillers = typeof scenario.fillers === 'function' ? scenario.fillers(answerText) : (scenario.fillers ?? [])
      for (const text of fillers) {
        if (distractors.length >= 3) break
        if (used.has(text)) continue
        used.add(text)
        distractors.push({ text, why: null })
      }
      if (distractors.length < 3) continue

      return assemble(scenario, answerText, answerResult, distractors.slice(0, 3), rng, seed, await runSteps(scenario))
    }
    throw new TemplateError(`${spec.id}(seed ${seed}): ${MAX_BUILD_TRIES}번 만들어도 서로 다른 보기 4개를 얻지 못했습니다`)
  }

  function assemble(
    scenario: TemplateScenario,
    answerText: string,
    answerResult: TableData,
    distractors: Distractor[],
    rng: Rng,
    seed: number,
    stepTables: string[],
  ): GeneratedQuestion {
    const all: Distractor[] = [{ text: answerText, why: null }, ...distractors]
    const ordered = numericChoices ? [...all].sort((a, b) => firstNumber(a.text) - firstNumber(b.text)) : rng.shuffle(all)
    const choices = ordered.map((c) => c.text) as ChoiceTexts
    const answer = (choices.indexOf(answerText) + 1) as ChoiceNumber

    // 안전 확인: 보기 4개 서로 다름, 정답 정확히 1개
    if (new Set(choices).size !== 4 || choices.filter((c) => c === answerText).length !== 1) {
      throw new TemplateError(`${spec.id}(seed ${seed}): 보기 구성 오류 ${JSON.stringify(choices)}`)
    }

    const answerMark = CHOICE_MARKS[answer]
    const trapLines = ordered
      .map((c, i) => ({ ...c, mark: CHOICE_MARKS[(i + 1) as ChoiceNumber] }))
      .filter((c) => c.text !== answerText)
      .map((c) => (c.why ? `${c.mark}(${c.text})은 ${c.why} 경우의 결과입니다.` : `${c.mark}(${c.text})은 계산 실수를 노린 값입니다.`))

    const explanation = [
      scenario.explain({ answerText, answerMark, answerResult }),
      ...stepTables,
      `실행 결과는 다음과 같습니다.\n\n${tableToMarkdown(answerResult)}`,
      trapLines.join(' '),
    ].join('\n\n')

    return {
      ...meta,
      templateId: spec.id,
      seed,
      stem: scenario.stem,
      tables: scenario.tables,
      ...(scenario.sql !== undefined && { sql: scenario.sql }),
      choices,
      answer,
      fixedOrder: numericChoices,
      explanation,
      examPoint: scenario.examPoint,
      ...(tags && { tags }),
    }
  }

  return { ...meta, generate }
}
