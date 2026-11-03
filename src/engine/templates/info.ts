/**
 * 템플릿 정보 목록 (T4-7) — 템플릿 코드 없이 정보만
 *
 * 연습 설정 화면은 이 목록으로 단원·유형을 거르고, 실제 문제를 만들 때만
 * 템플릿 코드(loadTemplates)를 불러온다 → 앱 첫 화면이 가벼워진다.
 * ⚠ 템플릿을 추가·수정하면 여기도 같이 고친다. (tests/templateIntegration.test.tsx 가 일치 여부를 검사)
 */
import type { TemplateInfo } from '../../domain'

export const TEMPLATE_INFO: readonly TemplateInfo[] = [
  { id: 'TP01', subject: 2, chapter: 'S1-04', topic: 'WHERE 조건 결과 건수', type: 'sql_result', difficulty: 2 },
  { id: 'TP02', subject: 2, chapter: 'S1-03', topic: 'NULL과 집계 함수 결과', type: 'sql_result', difficulty: 2 },
  { id: 'TP03', subject: 2, chapter: 'S1-05', topic: 'GROUP BY·HAVING 결과 행 수', type: 'sql_result', difficulty: 2 },
  { id: 'TP04', subject: 2, chapter: 'S1-08', topic: '조인 종류별 결과 건수', type: 'sql_result', difficulty: 2 },
  { id: 'TP05', subject: 2, chapter: 'S2-02', topic: '집합 연산자 결과 건수', type: 'sql_result', difficulty: 2 },
  { id: 'TP06', subject: 2, chapter: 'S2-01', topic: 'IN·NOT IN·EXISTS와 NULL', type: 'sql_result', difficulty: 3 },
  { id: 'TP07', subject: 2, chapter: 'S2-04', topic: '순위 함수 결과 값', type: 'sql_result', difficulty: 2 },
  { id: 'TP08', subject: 2, chapter: 'S2-04', topic: '집계 윈도우 함수 누적 값', type: 'sql_result', difficulty: 3 },
  { id: 'TP09', subject: 2, chapter: 'S2-05', topic: 'ROWNUM과 ORDER BY 순서', type: 'sql_result', difficulty: 3 },
  { id: 'TP10', subject: 2, chapter: 'S3-02', topic: '트랜잭션 시나리오 최종 결과', type: 'scenario', difficulty: 3 },
]
