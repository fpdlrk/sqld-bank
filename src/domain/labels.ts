import type { ChoiceNumber, Difficulty, QuestionType } from './types'

/** 화면 표시용 이름 (T3-1) */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  concept: '개념형',
  sql_result: '결과예측형',
  sql_error: '오류찾기형',
  sql_equivalent: '동치형',
  sql_fill: '빈칸형',
  modeling: '모델링 해석형',
  scenario: '시나리오형',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: '기본',
  2: '응용',
  3: '심화',
}

/** 보기 번호 표시 기호 — 화면 위치(1~4)에 붙인다 */
export const CHOICE_MARKS: Record<ChoiceNumber, string> = { 1: '①', 2: '②', 3: '③', 4: '④' }
