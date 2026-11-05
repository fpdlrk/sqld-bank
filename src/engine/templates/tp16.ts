/**
 * TP16 (S2-06) 계층형 질의 결과 건수 — docs/04 §7
 * 변형: 중간 노드부터 순방향 전개 / LEVEL 조건 / 말단부터 역방향 전개
 *
 * SQLite에는 CONNECT BY가 없으므로 실행용 SQL은 재귀 CTE로 만든다 (docs/04 §6).
 * 화면 SQL은 Oracle 문법 그대로 → tests/templates.test.ts가 JS 트리 계산으로 따로 대조한다.
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'
import { nearCounts, pickNames } from './data'

const STEM = '다음 [EMP] 테이블에 Oracle에서 SQL을 실행했을 때 결과 행의 수는?'

/** 순방향(부하 쪽) 전개 */
const down = (start: string, filter = '') => ({
  sql: `WITH RECURSIVE T(EMPNO, ENAME, LV) AS (SELECT EMPNO, ENAME, 1 FROM EMP WHERE ${start} UNION ALL SELECT E.EMPNO, E.ENAME, T.LV + 1 FROM EMP E JOIN T ON E.MGR = T.EMPNO) SELECT ENAME, LV AS "LEVEL" FROM T ${filter}`,
  format: format.count,
})
/** 역방향(상사 쪽) 전개 */
const up = (start: string, filter = '') => ({
  sql: `WITH RECURSIVE T(EMPNO, ENAME, MGR, LV) AS (SELECT EMPNO, ENAME, MGR, 1 FROM EMP WHERE ${start} UNION ALL SELECT E.EMPNO, E.ENAME, E.MGR, T.LV + 1 FROM EMP E JOIN T ON E.EMPNO = T.MGR) SELECT ENAME, LV AS "LEVEL" FROM T ${filter}`,
  format: format.count,
})

interface Tree {
  rows: CellValue[][]
  names: string[]
  parent: number[] // parent[i] = i번 사원의 상사 번호 (루트는 0)
  depth: number[]
}

function makeTree(rng: Rng): Tree {
  const n = rng.int(6, 9)
  const names = pickNames(rng, n)
  const parent = [0, 0]
  const depth = [0, 1]
  for (let i = 2; i <= n; i++) {
    const p = rng.int(Math.max(1, i - 3), i - 1)
    parent[i] = p
    depth[i] = (depth[p] ?? 0) + 1
  }
  const rows: CellValue[][] = names.map((name, i) => [i + 1, name, i === 0 ? null : (parent[i + 1] ?? null)])
  return { rows, names, parent, depth }
}

const childrenOf = (t: Tree, i: number) => t.parent.flatMap((p, k) => (p === i && k > 0 ? [k] : []))
const nameOf = (t: Tree, i: number) => t.names[i - 1] ?? ''
const sqlOf = (start: string, connect: string, where = '') =>
  `SELECT ENAME, LEVEL\n  FROM EMP\n${where ? ` WHERE ${where}\n` : ''} START WITH ${start}\nCONNECT BY ${connect};`
const table = (t: Tree) => [{ name: 'EMP', columns: ['EMPNO', 'ENAME', 'MGR'], rows: t.rows }]

function subtree(rng: Rng, t: Tree): TemplateScenario {
  const n = t.names.length
  const inner = [...Array(n).keys()].map((k) => k + 1).filter((i) => i > 1 && childrenOf(t, i).length > 0)
  const s = inner.length > 0 ? rng.pick(inner) : 1
  const start = `ENAME = '${nameOf(t, s)}'`
  return {
    tables: table(t),
    stem: STEM,
    sql: sqlOf(start, 'PRIOR EMPNO = MGR'),
    answer: down(start),
    traps: [
      { ...up(start), why: 'PRIOR의 위치를 반대로 보고 상사 쪽으로 올라간' },
      { ...down(start, 'WHERE LV > 1'), why: '시작 행을 빼고 센' },
      { ...down(start, 'WHERE LV <= 2'), why: '바로 아래 단계까지만 내려간' },
    ],
    fillers: nearCounts(n),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. START WITH로 정한 ${nameOf(t, s)}가 루트(LEVEL 1)가 되고, CONNECT BY PRIOR EMPNO = MGR은 "앞 행의 사번을 상사로 가진 행"을 찾아 부하 쪽으로 내려갑니다. 그래서 ${nameOf(t, s)}와 그 아래의 모든 부하(손자 단계 이하 포함)가 나옵니다. ${nameOf(t, s)}의 상사나 다른 가지의 사원은 나오지 않습니다.`,
    examPoint: 'PRIOR 자식쪽컬럼(EMPNO) = 부모쪽컬럼(MGR) → 순방향(부하 쪽). START WITH 행이 LEVEL 1.',
  }
}

function level(rng: Rng, t: Tree): TemplateScenario {
  const maxDepth = Math.max(...t.depth.slice(1))
  const k = rng.int(2, Math.max(2, maxDepth))
  const start = 'MGR IS NULL'
  return {
    tables: table(t),
    stem: STEM,
    sql: sqlOf(start, 'PRIOR EMPNO = MGR', `LEVEL = ${k}`),
    answer: down(start, `WHERE LV = ${k}`),
    traps: [
      { ...down(start, `WHERE LV <= ${k}`), why: `LEVEL ${k} 이하를 모두 센` },
      { ...down(start, `WHERE LV = ${k + 1}`), why: '루트의 LEVEL을 0으로 본' },
      { ...down(start), why: 'WHERE 조건을 무시하고 전체를 센' },
    ],
    fillers: nearCounts(t.names.length),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. MGR이 NULL인 ${nameOf(t, 1)}가 LEVEL 1이고, 한 단계 내려갈 때마다 LEVEL이 1씩 커집니다. 계층형 질의의 WHERE 절은 전개가 끝난 뒤 행을 거르므로, 전체 트리를 만든 다음 LEVEL이 ${k}인 행만 남깁니다. 루트에서 ${k - 1}단계 아래에 있는 사원을 세면 됩니다.`,
    examPoint: 'LEVEL은 루트가 1. 계층형 질의의 WHERE는 전개 후에 적용된다.',
  }
}

function upward(rng: Rng, t: Tree): TemplateScenario {
  const n = t.names.length
  const leaves = [...Array(n).keys()].map((k) => k + 1).filter((i) => childrenOf(t, i).length === 0 && (t.depth[i] ?? 0) >= 2)
  const s = leaves.length > 0 ? rng.pick(leaves) : n
  const start = `ENAME = '${nameOf(t, s)}'`
  return {
    tables: table(t),
    stem: STEM,
    sql: sqlOf(start, 'PRIOR MGR = EMPNO'),
    answer: up(start),
    traps: [
      { ...down(start), why: 'PRIOR의 위치를 반대로 보고 부하 쪽으로 내려간' },
      { ...up(start, 'WHERE LV > 1'), why: '시작 행을 빼고 센' },
      { text: `${n}건`, why: '역방향 전개도 전체 트리를 돌려준다고 본' },
    ],
    fillers: nearCounts(n),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. CONNECT BY PRIOR MGR = EMPNO는 "앞 행의 상사 번호를 사번으로 가진 행", 즉 상사를 찾아 위로 올라가는 역방향 전개입니다. 말단 사원 ${nameOf(t, s)}에서 시작해 최상위 ${nameOf(t, 1)}까지 한 줄로 이어진 경로의 사원만 나오므로, ${nameOf(t, s)}의 깊이(루트 포함 단계 수)만큼의 행이 됩니다.`,
    examPoint: 'PRIOR 부모쪽컬럼(MGR) = 자식쪽컬럼(EMPNO) → 역방향(상사 쪽), 시작 행부터 루트까지의 경로.',
  }
}

export const TP16 = defineTemplate({
  id: 'TP16',
  subject: 2,
  chapter: 'S2-06',
  topic: '계층형 질의 결과 건수',
  type: 'sql_result',
  difficulty: 3,
  tags: ['계층형 질의', 'CONNECT BY', 'LEVEL'],
  numericChoices: true,
  build(rng) {
    const t = makeTree(rng)
    return rng.pick([subtree, level, upward])(rng, t)
  },
})
