/**
 * domain/ — 타입 정의와 순수 로직 (채점·출제·통계)
 *
 * 규칙: 이 폴더의 코드는 React에 의존하지 않는다.
 * (화면 없이 테스트할 수 있고, 나중에 다른 곳에서도 재사용할 수 있게)
 */
export * from './types'
export * from './questionRef'
export {
  CHAPTERS,
  CHAPTER_CODES,
  PARTS,
  SUBJECTS,
  chapterLabel,
  chaptersOfPart,
  chaptersOfSubject,
  getChapter,
  isChapterCode,
  partOf,
} from './chapters'
export type { ChapterInfo, PartCode, PartInfo, SubjectInfo } from './chapters'
// 문제 스키마 검증(questionSchema.ts)은 여기서 내보내지 않는다.
// zod 라이브러리가 커서, 필요한 곳(테스트·문제 추가 폼)에서만 직접 import한다.
export { countByChapter, filterQuestions, findQuestion, mergeQuestions } from './questionBank'
export type { MergeResult, QuestionFilter } from './questionBank'
export type { QuestionProblem } from './questionSchema'
export { CHOICE_MARKS, DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from './labels'
export { createAttempt, elapsedSeconds, isCorrect, newId } from './grading'
export type { AttemptInput } from './grading'
export {
  DEFAULT_PRACTICE_SETTINGS,
  PRACTICE_SETTINGS_KEY,
  TEMPLATE_SLOTS,
  filterTemplates,
  normalizePracticeSettings,
  pickPracticeItems,
  pickPracticeQuestions,
  practiceItems,
  practiceCandidates,
  shuffled,
  summarizeAttempts,
  withSubjects,
} from './practice'
export type { PracticeCount, PracticeItem, PracticeSettings, ProgressFilter, QuestionStat } from './practice'
export { createPracticeSession, finishSession, moveTo, recordAnswer, summarizeSession } from './session'
export type { ChapterResult, CreateSessionOptions, SessionSummary } from './session'
export { ORIGINAL_ORDER, isValidChoiceOrder, makeChoiceOrder, remapChoiceMarks } from './choiceOrder'
export {
  EXAM_MAX_SCORE,
  EXAM_RULES,
  EXAM_SUBJECTS,
  EXAM_TOTAL_QUESTIONS,
  examEndsAt,
  formatClock,
  gradeExam,
  isWarningTime,
  remainingSeconds,
  verdictLabel,
} from './examRules'
export type { ExamGrade, ExamItemResult, ExamVerdict, SubjectGrade, SubjectRule } from './examRules'
