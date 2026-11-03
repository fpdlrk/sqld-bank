/**
 * engine/ — 템플릿 문제 엔진
 *
 * 시드 난수 생성기, sql.js(SQLite WASM) 실행기, 템플릿 문제들이 들어온다.
 * 같은 시드를 넣으면 항상 같은 문제가 나오도록 만든다.
 */
export { MAX_SEED, createRng, normalizeSeed, randomSeed } from './rng'
export type { Rng } from './rng'
export {
  getSqlEngineStatus,
  loadSqlEngine,
  onSqlEngineStatus,
  openDatabase,
  setSqlEngineLoader,
  withDatabase,
} from './sqlRunner'
export type { SqlDatabase, SqlEngineStatus } from './sqlRunner'
export { MAX_BUILD_TRIES, TemplateError, defineTemplate, format, tableToMarkdown } from './template'
export type { ExplainContext, SqlProbe, TemplateScenario, TemplateSpec, TrapProbe } from './template'
// 템플릿 코드는 여기서 바로 내보내지 않는다 — 필요할 때 loadTemplates()로 불러온다 (앱 첫 화면을 가볍게)
// 테스트에서 직접 쓰려면 '../src/engine/templates'에서 import
export { TEMPLATE_INFO } from './templates/info'
export { generateTemplateQuestion, loadTemplates } from './loadTemplates'
