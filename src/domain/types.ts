/**
 * 도메인 타입 (T2-1)
 *
 * 앱 전체가 공유하는 데이터 모양. 기준 문서: docs/04 §5 (문제 JSON), docs/01 §6 (저장 데이터).
 * 이 파일은 React·Dexie 등 어떤 라이브러리에도 의존하지 않는다.
 *
 * 날짜·시각은 모두 ISO 문자열("2026-11-02T09:30:00.000Z")로 저장한다.
 * → 백업 JSON을 사람이 읽을 수 있고, 문자열 정렬이 곧 시간순 정렬이 된다.
 */
import type { ChapterCode } from './chapters'

// ───────────────────────────── 기본 값 ─────────────────────────────

/** 과목: 1 = 데이터 모델링의 이해, 2 = SQL 기본과 활용 */
export type Subject = 1 | 2

/**
 * 단원 코드 (예: "S1-05") — chapters.ts의 단원표에 있는 30개 중 하나.
 * 접두어: M1·M2 = 1과목, S1·S2·S3 = 2과목
 */
export type { ChapterCode }

/** 문제 유형 (docs/04 §3) */
export type QuestionType =
  | 'concept' // 개념형
  | 'sql_result' // 결과예측형
  | 'sql_error' // 오류찾기형
  | 'sql_equivalent' // 동치형
  | 'sql_fill' // 빈칸형
  | 'modeling' // 모델링 해석형
  | 'scenario' // 시나리오형

/** 난이도: 1 기본 / 2 응용(함정 1개) / 3 심화(함정 2개 이상) */
export type Difficulty = 1 | 2 | 3

/** 보기 번호 ①~④. 정답·선택한 답은 항상 "원래 번호"로 기록한다. */
export type ChoiceNumber = 1 | 2 | 3 | 4

/** 문제 출처: Claude가 만든 문제 / 사용자가 직접 추가한 문제 */
export type QuestionSource = 'claude' | 'user'

/** ISO 8601 날짜·시각 문자열 */
export type IsoDateTime = string

// ───────────────────────────── 표 ─────────────────────────────

/** 표 한 칸의 값. NULL은 JSON null */
export type CellValue = string | number | null

/** 예시 테이블 또는 SQL 실행 결과 표 */
export interface TableData {
  /** 테이블 이름 (예: "EMP"). 실행 결과 표처럼 이름이 없으면 생략 */
  name?: string
  columns: string[]
  /** 각 행은 columns와 같은 순서·같은 개수 */
  rows: CellValue[][]
}

// ───────────────────────────── 문제 ─────────────────────────────

/** 보기 4개. 순서 = 원래 번호(①②③④) */
export type ChoiceTexts = [string, string, string, string]

/**
 * 화면에 보여 줄 보기 한 개 (T3-5 보기 섞기용)
 * 섞인 뒤에도 no(원래 번호)는 그대로라서 채점은 no로 한다.
 */
export interface Choice {
  no: ChoiceNumber
  text: string
}

/** 정답 자동 검증 방법 (docs/04 §5 verify) */
export interface VerifySpec {
  /** true면 테스트가 `sqlExec ?? sql`을 sql.js로 실행해 정답 보기와 대조 */
  executable: boolean
  /** 대조 방법: 결과 행 수 / 단일 값 / 결과표 전체 */
  expect?: 'rowCount' | 'value' | 'resultTable'
}

/** 고정 문제·템플릿 문제가 공통으로 가지는 "화면에 보이는 내용" */
export interface QuestionContent {
  subject: Subject
  chapter: ChapterCode
  /** 20자 내외 세부 주제 */
  topic: string
  type: QuestionType
  difficulty: Difficulty
  /** 문제 본문 (Markdown) */
  stem: string
  /** 예시 테이블 */
  tables?: TableData[]
  /** 화면에 보여 줄 SQL (Oracle 문법) */
  sql?: string
  choices: ChoiceTexts
  answer: ChoiceNumber
  /** true면 보기 순서를 섞지 않는다 ("모두 옳은 것은?" 류) */
  fixedOrder?: boolean
  /** 해설 (Markdown, docs/04 §4) */
  explanation: string
  /** 시험 포인트 한 줄 */
  examPoint: string
  tags?: string[]
}

/** 고정 문제 — src/data/questions/*.json 의 한 항목 */
export interface Question extends QuestionContent {
  /** `{단원코드}-{4자리}` (예: "S1-05-0003"), 직접 추가는 `U-{단원코드}-{4자리}` */
  id: string
  source: QuestionSource
  /** sql.js 실행용 SQL. Oracle 문법을 그대로 실행할 수 없을 때만 (docs/04 §6) */
  sqlExec?: string
  verify?: VerifySpec
}

/** 사용자가 직접 추가한 문제 (IndexedDB userQuestions 테이블) */
export interface UserQuestion extends Question {
  source: 'user'
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

// ───────────────────────────── 템플릿 ─────────────────────────────

/** 템플릿이 시드 하나로 만들어 낸 문제 1개 */
export interface GeneratedQuestion extends QuestionContent {
  /** 만든 템플릿 ID (예: "TP01") */
  templateId: string
  /** 같은 templateId + seed → 항상 같은 문제 */
  seed: number
}

/**
 * 템플릿 문제 생성기 (Phase 4)
 * generate가 Promise인 이유: sql.js(WASM)를 처음 불러오는 작업이 비동기이기 때문.
 */
export interface QuestionTemplate {
  /** "TP01" ~ */
  id: string
  subject: Subject
  chapter: ChapterCode
  topic: string
  type: QuestionType
  difficulty: Difficulty
  generate: (seed: number) => Promise<GeneratedQuestion>
}

/**
 * 템플릿의 정보만 (generate 제외) — 템플릿 코드를 불러오지 않고도
 * 연습 설정 화면에서 단원·유형으로 거를 수 있게 하기 위한 가벼운 목록용 (T4-7)
 */
export type TemplateInfo = Omit<QuestionTemplate, 'generate'>

/** 화면에서 다루는 문제 = 고정 문제 또는 템플릿 문제 */
export type AnyQuestion = Question | GeneratedQuestion

/** 템플릿으로 만든 문제인지 구분 */
export function isGenerated(q: AnyQuestion): q is GeneratedQuestion {
  return 'templateId' in q
}

// ───────────────────────────── 풀이 기록 ─────────────────────────────

/**
 * 문제를 가리키는 문자열 키 (만들기·풀기는 questionRef.ts)
 * - 고정 문제: 문제 ID 그대로        "S1-05-0003"
 * - 템플릿 문제: 템플릿ID#시드         "TP01#123456"
 */
export type QuestionRef = string

/** 풀이 방식: 단원별 연습 / 모의고사 / 오답 복습 */
export type StudyMode = 'practice' | 'exam' | 'review'

/** 한 문제를 푼 기록 1건 (IndexedDB attempts) */
export interface Attempt {
  id: string
  questionRef: QuestionRef
  sessionId: string
  mode: StudyMode
  /** 고른 보기의 원래 번호. 모의고사에서 안 푼 문항이면 null */
  chosen: ChoiceNumber | null
  correct: boolean
  /** 이 문제에 쓴 시간(초) */
  elapsedSec: number
  at: IsoDateTime
}

/**
 * 과목별 획득 점수 (문항당 2점 — 1과목 20점·2과목 80점 만점, 합계가 총점)
 * 과락 기준(1과목 8점·2과목 32점 미만)과 같은 단위로 맞췄다 (T5-3)
 */
export type SubjectScores = Record<Subject, number>

/**
 * 진행 중인 회차의 상태 — 새로고침·앱 전환 후 이어 풀기용 (T3-4, T5-3)
 * 회차가 끝나면 지워도 된다.
 */
export interface SessionProgress {
  /** 지금 보고 있는 문항 위치 (0부터) */
  currentIndex: number
  /** 문항별로 고른 답 (원래 번호) */
  answers: Record<QuestionRef, ChoiceNumber>
  /** 모의고사에서 "표시하기" 한 문항 */
  flagged: QuestionRef[]
  /** 섞인 보기 순서 — 복구했을 때 보기 순서가 바뀌지 않도록 저장 */
  choiceOrders: Record<QuestionRef, ChoiceNumber[]>
  /** 모의고사 종료 시각. 남은 시간은 매번 (endsAt - 지금)으로 계산 */
  endsAt?: IsoDateTime
}

/** 연습·모의고사·복습 1회 (IndexedDB sessions) */
export interface Session {
  id: string
  mode: StudyMode
  startedAt: IsoDateTime
  /** 아직 진행 중이면 null */
  finishedAt: IsoDateTime | null
  /** 출제된 문항 순서 그대로 */
  questionRefs: QuestionRef[]
  /** 맞힌 문항 수. 끝나기 전에는 null */
  score: number | null
  subjectScores: SubjectScores | null
  /** 모의고사 합격 여부. 연습·복습은 null */
  passed: boolean | null
  progress?: SessionProgress
}

/** 오답노트 상태·메모 (IndexedDB notes, 문제 하나당 1건) */
export interface Note {
  questionRef: QuestionRef
  bookmarked: boolean
  memo: string
  /** "이제 안다" 처리 → 오답노트 목록에서 빠짐 */
  mastered: boolean
  /**
   * "이제 안다"를 누른 시각 (T6-2). 이 시각 뒤에 다시 틀리면 오답노트에 다시 나타난다.
   * (없으면 updatedAt을 대신 쓴다 — 예전 데이터 호환)
   */
  masteredAt?: IsoDateTime
  /** 마지막으로 바뀐 시각 (메모·북마크 포함) */
  updatedAt: IsoDateTime
}

/** 설정·시험일·스키마 버전 등 key-value (IndexedDB meta) */
export interface MetaEntry<T = unknown> {
  key: string
  value: T
}
