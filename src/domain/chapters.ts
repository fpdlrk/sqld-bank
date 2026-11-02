import type { Subject } from './types'

/**
 * 단원 코드표 (T2-2) — docs/04 §2 기준
 *
 * 모의고사 비중(examWeight)은 "모의고사 50문항 중 이 단원에서 낼 문항 수"의 앱 기본값이다.
 * 실제 시험 출제 비율이 아니라 공개된 과목별 문항 수(10 / 40)에 맞춘 추정치이므로,
 * 바꾸고 싶으면 이 파일의 숫자만 고치면 된다. (테스트가 합계를 검사한다)
 *
 * 1과목 규칙: 고정 비중 합계 9 + "optional" 단원(0~1문항) 중 1개를 무작위로 골라 10문항.
 */

// ───────────────────────────── 과목 ─────────────────────────────

export interface SubjectInfo {
  subject: Subject
  name: string
  /** 모의고사 문항 수 */
  examCount: number
}

export const SUBJECTS: readonly SubjectInfo[] = [
  { subject: 1, name: '데이터 모델링의 이해', examCount: 10 },
  { subject: 2, name: 'SQL 기본과 활용', examCount: 40 },
]

// ───────────────────────────── 파트 (단원 묶음) ─────────────────────────────

export type PartCode = 'M1' | 'M2' | 'S1' | 'S2' | 'S3'

export interface PartInfo {
  code: PartCode
  subject: Subject
  /** 화면 표시용 (예: "1과목 A") */
  label: string
  name: string
}

export const PARTS: readonly PartInfo[] = [
  { code: 'M1', subject: 1, label: '1과목 A', name: '데이터 모델링의 이해' },
  { code: 'M2', subject: 1, label: '1과목 B', name: '데이터 모델과 SQL' },
  { code: 'S1', subject: 2, label: '2과목 A', name: 'SQL 기본' },
  { code: 'S2', subject: 2, label: '2과목 B', name: 'SQL 활용' },
  { code: 'S3', subject: 2, label: '2과목 C', name: '관리 구문' },
]

// ───────────────────────────── 단원 ─────────────────────────────

export interface ChapterInfo {
  code: string
  subject: Subject
  name: string
  /** 세부 주제 (연습 화면 설명·검색용) */
  topics: string
  /** 모의고사 고정 문항 수 */
  examWeight: number
  /** true면 "0~1문항" 단원 — 1과목 모의고사에서 이 중 1개만 무작위로 1문항 */
  optional?: boolean
}

export const CHAPTERS = [
  // ── 1과목 A. 데이터 모델링의 이해
  { code: 'M1-01', subject: 1, name: '데이터 모델의 이해', examWeight: 2,
    topics: '모델링 특징·관점, 개념/논리/물리 모델링, 3단계 스키마(외부·개념·내부)와 독립성, ERD 표기' },
  { code: 'M1-02', subject: 1, name: '엔터티', examWeight: 1,
    topics: '정의·특징, 분류(유무형, 발생 시점: 기본/중심/행위), 명명 규칙' },
  { code: 'M1-03', subject: 1, name: '속성', examWeight: 1,
    topics: '정의, 분류(기본/설계/파생), 도메인, 명명' },
  { code: 'M1-04', subject: 1, name: '관계', examWeight: 1,
    topics: '존재적/행위적 관계, 차수(카디널리티), 선택성(참여도), 관계 읽는 법' },
  { code: 'M1-05', subject: 1, name: '식별자', examWeight: 1,
    topics: '주식별자 특징(유일성·최소성·불변성·존재성), 분류(본질/인조, 단일/복합, 내부/외부), 식별/비식별 관계' },

  // ── 1과목 B. 데이터 모델과 SQL
  { code: 'M2-01', subject: 1, name: '정규화', examWeight: 2,
    topics: '함수 종속, 1~3정규형·BCNF, 이상현상, 반정규화' },
  { code: 'M2-02', subject: 1, name: '관계와 조인의 이해', examWeight: 1,
    topics: '관계가 조인으로 표현되는 방식, 계층형·상호배타 관계' },
  { code: 'M2-03', subject: 1, name: '모델이 표현하는 트랜잭션', examWeight: 0, optional: true,
    topics: '트랜잭션 단위와 관계의 필수/선택 표현' },
  { code: 'M2-04', subject: 1, name: 'Null 속성의 이해', examWeight: 0, optional: true,
    topics: 'NULL의 의미, 연산·집계에서의 동작, 모델링 시 고려' },
  { code: 'M2-05', subject: 1, name: '본질식별자 vs 인조식별자', examWeight: 0, optional: true,
    topics: '인조식별자의 장단점, 중복 데이터 위험' },

  // ── 2과목 A. SQL 기본
  { code: 'S1-01', subject: 2, name: '관계형 데이터베이스 개요', examWeight: 1,
    topics: '테이블·키, SQL 분류(DML/DDL/DCL/TCL)' },
  { code: 'S1-02', subject: 2, name: 'SELECT문', examWeight: 1,
    topics: '별칭, DISTINCT, 연결 연산자, 산술 연산과 NULL' },
  { code: 'S1-03', subject: 2, name: '함수', examWeight: 3,
    topics: '문자·숫자·날짜·변환 함수, CASE/DECODE, NULL 함수(NVL, NVL2, NULLIF, COALESCE)' },
  { code: 'S1-04', subject: 2, name: 'WHERE절', examWeight: 2,
    topics: '비교·논리 연산자 우선순위, BETWEEN, IN, LIKE(와일드카드·ESCAPE), IS NULL' },
  { code: 'S1-05', subject: 2, name: 'GROUP BY, HAVING절', examWeight: 3,
    topics: '집계 함수와 NULL, COUNT(*) vs COUNT(컬럼), WHERE vs HAVING' },
  { code: 'S1-06', subject: 2, name: 'ORDER BY절', examWeight: 1,
    topics: '정렬 기준·NULL 정렬 위치, SELECT 실행 순서' },
  { code: 'S1-07', subject: 2, name: '조인', examWeight: 2,
    topics: 'EQUI/NON-EQUI 조인, 다중 테이블 조인' },
  { code: 'S1-08', subject: 2, name: '표준 조인', examWeight: 3,
    topics: 'INNER/NATURAL/USING/ON, OUTER(LEFT/RIGHT/FULL), CROSS' },

  // ── 2과목 B. SQL 활용
  { code: 'S2-01', subject: 2, name: '서브쿼리', examWeight: 4,
    topics: '단일/다중 행, 다중 컬럼, 연관 서브쿼리, EXISTS, 스칼라·인라인 뷰, 뷰' },
  { code: 'S2-02', subject: 2, name: '집합 연산자', examWeight: 2,
    topics: 'UNION / UNION ALL / INTERSECT / MINUS' },
  { code: 'S2-03', subject: 2, name: '그룹 함수', examWeight: 2,
    topics: 'ROLLUP, CUBE, GROUPING SETS, GROUPING 함수' },
  { code: 'S2-04', subject: 2, name: '윈도우 함수', examWeight: 3,
    topics: '순위(RANK/DENSE_RANK/ROW_NUMBER), 집계 윈도우, 행 순서(LAG/LEAD/FIRST_VALUE), 비율(RATIO_TO_REPORT 등), WINDOWING 절' },
  { code: 'S2-05', subject: 2, name: 'Top N 쿼리', examWeight: 1,
    topics: 'ROWNUM의 동작 순서, FETCH FIRST / OFFSET' },
  { code: 'S2-06', subject: 2, name: '계층형 질의와 셀프 조인', examWeight: 2,
    topics: 'START WITH, CONNECT BY PRIOR, LEVEL, 방향, 셀프 조인' },
  { code: 'S2-07', subject: 2, name: 'PIVOT / UNPIVOT', examWeight: 1,
    topics: '행↔열 변환' },
  { code: 'S2-08', subject: 2, name: '정규 표현식', examWeight: 1,
    topics: 'REGEXP_LIKE/SUBSTR/REPLACE/INSTR/COUNT, 메타문자' },

  // ── 2과목 C. 관리 구문
  { code: 'S3-01', subject: 2, name: 'DML', examWeight: 3,
    topics: 'INSERT/UPDATE/DELETE/MERGE' },
  { code: 'S3-02', subject: 2, name: 'TCL', examWeight: 2,
    topics: 'COMMIT, ROLLBACK, SAVEPOINT, 자동 커밋(DDL)' },
  { code: 'S3-03', subject: 2, name: 'DDL', examWeight: 2,
    topics: 'CREATE/ALTER/DROP/TRUNCATE/RENAME, 제약조건, DELETE vs TRUNCATE vs DROP' },
  { code: 'S3-04', subject: 2, name: 'DCL', examWeight: 1,
    topics: 'GRANT, REVOKE, ROLE' },
] as const satisfies readonly ChapterInfo[]

/** 실제로 존재하는 단원 코드 30개 중 하나 (오타는 타입 오류) */
export type ChapterCode = (typeof CHAPTERS)[number]['code']

/** 스키마 검증(T2-3) 등에서 쓰는 코드 목록 */
export const CHAPTER_CODES = CHAPTERS.map((c) => c.code) as [ChapterCode, ...ChapterCode[]]

// ───────────────────────────── 조회 함수 ─────────────────────────────

const byCode = new Map<string, ChapterInfo>(CHAPTERS.map((c) => [c.code, c]))

export function isChapterCode(value: string): value is ChapterCode {
  return byCode.has(value)
}

export function getChapter(code: ChapterCode): ChapterInfo {
  const chapter = byCode.get(code)
  if (!chapter) throw new Error(`알 수 없는 단원 코드입니다: ${code}`)
  return chapter
}

export function chaptersOfSubject(subject: Subject): ChapterInfo[] {
  return CHAPTERS.filter((c) => c.subject === subject)
}

/** "S1-05" → "S1" */
export function partOf(code: ChapterCode): PartInfo {
  const part = PARTS.find((p) => code.startsWith(`${p.code}-`))
  if (!part) throw new Error(`파트를 찾을 수 없습니다: ${code}`)
  return part
}

export function chaptersOfPart(part: PartCode): ChapterInfo[] {
  return CHAPTERS.filter((c) => c.code.startsWith(`${part}-`))
}

/** 화면 표시용 "S1-05 GROUP BY, HAVING절" */
export function chapterLabel(code: ChapterCode): string {
  return `${code} ${getChapter(code).name}`
}
