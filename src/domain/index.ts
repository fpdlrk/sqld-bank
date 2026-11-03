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
