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
export { questionSchema, validateQuestionFiles, formatProblem } from './questionSchema'
export type { QuestionProblem } from './questionSchema'
