// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import initSqlJs from 'sql.js'
import type { CellValue, GeneratedQuestion, TableData } from '../src/domain'
import { CHOICE_MARKS } from '../src/domain'
import { format, setSqlEngineLoader, withDatabase } from '../src/engine'
import { TEMPLATES, findTemplate } from '../src/engine/templates'

beforeAll(() => setSqlEngineLoader(() => initSqlJs()))
afterAll(() => setSqlEngineLoader(undefined))

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 104729 + 17)

/** 화면 SQL(Oracle) → SQLite (docs/04 §6 중 템플릿이 쓰는 규칙만) */
/** Oracle의 NULL 정렬(ASC면 마지막, DESC면 처음)을 SQLite에서 재현하려면 NULLS FIRST/LAST를 명시해야 한다 (docs/04 §6) */
const oracleNullOrder = (sql: string) =>
  /NULLS (FIRST|LAST)/.test(sql)
    ? sql
    : sql.replace(/ORDER BY COMM( ASC| DESC)?,/, (_m, dir?: string) => `ORDER BY COMM${dir ?? ''} ${dir === ' DESC' ? 'NULLS FIRST' : 'NULLS LAST'},`)
const toSqlite = (sql: string) => oracleNullOrder(sql.replace(/\bMINUS\b/g, 'EXCEPT').replace(/\bNVL\(/g, 'IFNULL('))

/** 화면 SQL이 Oracle 전용 문법이라 SQLite로 바로 실행할 수 없는 템플릿 → 아래에서 JS 계산으로 따로 대조 */
const ORACLE_ONLY = new Set(['TP09', 'TP15', 'TP16'])

/**
 * 트랜잭션 시나리오(TP10) 화면 SQL → SQLite: Oracle처럼 첫 문장부터 트랜잭션이 되도록 BEGIN을 넣는다.
 * (템플릿 코드와 별개로 테스트에서 직접 변환한다)
 */
const txToSqlite = (sql: string) => `BEGIN;\n${sql.replace(/^COMMIT;$/gm, 'COMMIT;\nBEGIN;')}`

/** 문제 본문 "ENAME이 'KIM'인 행의 RNK 값은?" → ['KIM', 'RNK'] */
const targetOf = (q: GeneratedQuestion) => {
  const m = /ENAME이 '(\w+)'인 행의 (\w+) 값/.exec(q.stem)
  return m ? { name: m[1] ?? '', col: m[2] ?? '' } : undefined
}

/** 화면 SQL을 직접 실행해 정답 보기 글자를 다시 계산 (TP09 ROWNUM은 아래 JS 계산으로 따로 검사) */
async function answerFromDisplaySql(q: GeneratedQuestion): Promise<string> {
  const sql = q.templateId === 'TP10' ? txToSqlite(q.sql ?? '') : toSqlite(q.sql ?? '')
  const r = await withDatabase(q.tables ?? [], (db) => db.query(sql))
  const target = targetOf(q)
  if (target) {
    const row = r.rows.find((x) => x[r.columns.indexOf('ENAME')] === target.name)
    return String(row?.[r.columns.indexOf(target.col)])
  }
  const correct = q.choices[q.answer - 1] ?? ''
  return correct.endsWith('건') ? format.count(r) : format.value(r)
}

const cache = new Map<string, GeneratedQuestion[]>()
async function generated(id: string): Promise<GeneratedQuestion[]> {
  if (!cache.has(id)) {
    const t = findTemplate(id)!
    const list: GeneratedQuestion[] = []
    for (const s of SEEDS) list.push(await t.generate(s))
    cache.set(id, list)
  }
  return cache.get(id)!
}

const column = (t: TableData | undefined, name: string): CellValue[] => {
  const i = t?.columns.indexOf(name) ?? -1
  return (t?.rows ?? []).map((r) => r[i] ?? null)
}

describe('T4-4 템플릿 목록', () => {
  it('TP01~TP18이 docs/04 §7의 단원으로 등록돼 있다', () => {
    expect(TEMPLATES.map((t) => [t.id, t.chapter])).toEqual([
      ['TP01', 'S1-04'],
      ['TP02', 'S1-03'],
      ['TP03', 'S1-05'],
      ['TP04', 'S1-08'],
      ['TP05', 'S2-02'],
      ['TP06', 'S2-01'],
      ['TP07', 'S2-04'],
      ['TP08', 'S2-04'],
      ['TP09', 'S2-05'],
      ['TP10', 'S3-02'],
      ['TP11', 'S1-03'],
      ['TP12', 'S1-03'],
      ['TP13', 'S1-06'],
      ['TP14', 'S1-07'],
      ['TP15', 'S2-03'],
      ['TP16', 'S2-06'],
      ['TP17', 'S2-01'],
      ['TP18', 'S3-01'],
    ])
  })
})

describe.each(TEMPLATES.map((t) => [t.id]))('T4-4·T4-5 %s (시드 150개)', (id) => {
  it('보기 4개 서로 다름, 정답 1개, 같은 시드 → 같은 문제', async () => {
    const list = await generated(id)
    for (const q of list) {
      expect(new Set(q.choices).size).toBe(4)
      expect(q.templateId).toBe(id)
    }
    expect(await findTemplate(id)!.generate(SEEDS[3]!)).toEqual(list[3])
  })

  it.skipIf(ORACLE_ONLY.has(id))('화면에 보이는 SQL을 직접 실행한 결과 = 정답 보기', async () => {
    for (const q of await generated(id)) {
      expect(await answerFromDisplaySql(q), `${id} seed ${q.seed}\n${q.sql}`).toBe(q.choices[q.answer - 1])
    }
  })

  it('해설: "정답은 X(정답)" + 실행 결과 표 + 오답 보기 3개 모두 설명', async () => {
    for (const q of await generated(id)) {
      const mark = CHOICE_MARKS[q.answer]
      expect(q.explanation).toContain(`정답은 ${mark}(${q.choices[q.answer - 1]})`)
      expect(q.explanation).toContain('실행 결과는 다음과 같습니다.')
      q.choices.forEach((c, i) => {
        if (i + 1 !== q.answer) expect(q.explanation).toContain(`${CHOICE_MARKS[(i + 1) as 1]}(${c})은`)
      })
    }
  })

  it('해설·시험 포인트의 ①~④는 보기를 가리킬 때만 쓴다 — 보기를 섞으면 화면 번호로 바뀌기 때문 (docs/04 §4)', async () => {
    for (const q of await generated(id)) {
      // 보기를 가리키는 표기는 항상 "③(3건)"처럼 바로 뒤에 괄호가 온다
      expect(q.explanation, `${id} seed ${q.seed}`).not.toMatch(/[①②③④](?!\()/)
      expect(q.examPoint).not.toMatch(/[①②③④]/)
    }
  })

  it('보충 보기는 정답 근처 숫자에서 고른다 (정답과 3 넘게 차이 나는 "계산 실수" 보기 없음)', async () => {
    for (const q of await generated(id)) {
      if (!q.choices[q.answer - 1]?.endsWith('건')) continue // 건수 보기에만 해당
      const answer = Number.parseInt(q.choices[q.answer - 1] ?? '', 10)
      const fillerTexts = [...q.explanation.matchAll(/[①②③④]\(([^)]*)\)은 계산 실수를 노린 값/g)].map((m) => m[1] ?? '')
      for (const t of fillerTexts) expect(Math.abs(Number.parseInt(t, 10) - answer), `${id} seed ${q.seed}: ${t}`).toBeLessThanOrEqual(3)
    }
  })

  it('데이터 규칙: 행 3~12 (DEPT 같은 보조 테이블은 3행부터), 컬럼 5개 이하', async () => {
    for (const q of await generated(id)) {
      for (const t of q.tables ?? []) {
        expect(t.rows.length).toBeGreaterThanOrEqual(3)
        expect(t.rows.length).toBeLessThanOrEqual(12)
        expect(t.columns.length).toBeLessThanOrEqual(5)
      }
    }
  })
})

describe('T4-4 템플릿별 세부 규칙', () => {
  it('TP01: 세 변형(우선순위·BETWEEN·LIKE)이 모두 나온다', async () => {
    const sqls = (await generated('TP01')).map((q) => q.sql ?? '')
    expect(sqls.some((s) => / OR .* AND /.test(s))).toBe(true)
    expect(sqls.some((s) => s.includes('BETWEEN'))).toBe(true)
    expect(sqls.some((s) => s.includes('LIKE'))).toBe(true)
  })

  it('TP02: COMM NULL ≥ 2행, AVG는 JS로 계산한 값과 같고 정수', async () => {
    let avgCount = 0
    for (const q of await generated('TP02')) {
      const comm = column(q.tables?.[0], 'COMM')
      expect(comm.filter((v) => v === null).length).toBeGreaterThanOrEqual(2)
      if (q.sql?.includes('AVG')) {
        avgCount++
        const vals = comm.filter((v): v is number => typeof v === 'number')
        const expected = vals.reduce((a, b) => a + b, 0) / vals.length
        expect(Number.isInteger(expected)).toBe(true)
        expect(q.choices[q.answer - 1]).toBe(String(expected))
      }
    }
    expect(avgCount).toBeGreaterThan(10)
  })

  it('TP03: 부서마다 2행 이상', async () => {
    for (const q of await generated('TP03')) {
      const counts = new Map<CellValue, number>()
      for (const d of column(q.tables?.[0], 'DEPTNO')) counts.set(d, (counts.get(d) ?? 0) + 1)
      for (const n of counts.values()) expect(n).toBeGreaterThanOrEqual(2)
    }
  })

  it('TP04: 짝 없는 행이 양쪽에 1행 이상, 네 가지 조인과 ON 조건 변형이 모두 나온다', async () => {
    const list = await generated('TP04')
    for (const q of list) {
      const empDept = column(q.tables?.[0], 'DEPTNO')
      const deptNos = column(q.tables?.[1], 'DEPTNO')
      expect(empDept.some((d) => d === null || !deptNos.includes(d))).toBe(true)
      expect(deptNos.some((d) => !empDept.includes(d))).toBe(true)
    }
    for (const kind of ['INNER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'AND E.SAL']) {
      expect(list.some((q) => q.sql?.includes(kind)), kind).toBe(true)
    }
  })

  it('TP05: 각 테이블에 중복 값이 있고, 결과 건수가 JS 집합 계산과 같다', async () => {
    for (const q of await generated('TP05')) {
      const a = column(q.tables?.[0], 'CODE') as string[]
      const b = column(q.tables?.[1], 'CODE') as string[]
      expect(new Set(a).size).toBeLessThan(a.length)
      const op = /\n(UNION ALL|UNION|INTERSECT|MINUS)\n/.exec(q.sql ?? '')?.[1]
      const sa = new Set(a)
      const sb = new Set(b)
      const expected = {
        UNION: new Set([...a, ...b]).size,
        'UNION ALL': a.length + b.length,
        INTERSECT: [...sa].filter((v) => sb.has(v)).length,
        MINUS: [...sa].filter((v) => !sb.has(v)).length,
      }[op as 'UNION']
      expect(q.choices[q.answer - 1], `${op} seed ${q.seed}`).toBe(`${expected}건`)
    }
  })

  it('중간 단계 표: TP03 해설에 WHERE 적용 후·그룹 집계 표가 들어간다', async () => {
    const q = (await generated('TP03')).find((x) => x.sql?.includes('WHERE'))!
    expect(q.explanation).toContain('**1단계: WHERE SAL >=')
    expect(q.explanation).toContain('**2단계: GROUP BY DEPTNO 집계 (HAVING 적용 전)**')
  })
})

// ───────────── T4-5: SQL 실행과 별개로 JS로 정답을 계산해 대조 ─────────────

describe('T4-5 템플릿별 세부 규칙', () => {
  it('TP06: NOT IN 서브쿼리에 NULL이 있으면 정답은 0건, 세 변형이 모두 나온다', async () => {
    const list = await generated('TP06')
    for (const q of list) {
      const empDept = column(q.tables?.[0], 'DEPTNO')
      if (q.sql?.includes('NOT IN') && empDept.includes(null)) expect(q.choices[q.answer - 1]).toBe('0건')
    }
    expect(list.some((q) => q.sql?.includes('NOT IN'))).toBe(true)
    expect(list.some((q) => q.sql?.includes('NOT EXISTS'))).toBe(true)
    expect(list.some((q) => /WHERE DEPTNO IN/.test(q.sql ?? ''))).toBe(true)
  })

  it('TP07: 순위 값을 JS로 계산한 값과 같다 (ROW_NUMBER는 대상 값이 겹치지 않을 때만 묻는다)', async () => {
    const seen = new Set<string>()
    for (const q of await generated('TP07')) {
      const fn = /(RANK|DENSE_RANK|ROW_NUMBER)\(\)/.exec(q.sql ?? '')?.[1] ?? ''
      const part = (q.sql ?? '').includes('PARTITION BY DEPTNO')
      const desc = (q.sql ?? '').includes('SAL DESC')
      seen.add(fn)
      const rows = q.tables?.[0]?.rows ?? []
      const t = rows.find((r) => r[1] === targetOf(q)?.name)!
      const scope = part ? rows.filter((r) => r[2] === t[2]) : rows
      const sal = (r: CellValue[]) => r[3] as number
      const better = (r: CellValue[]) => (desc ? sal(r) > sal(t) : sal(r) < sal(t))
      const expected =
        fn === 'DENSE_RANK' ? new Set(scope.filter(better).map(sal)).size + 1 : scope.filter(better).length + 1
      if (fn === 'ROW_NUMBER') expect(rows.filter((r) => sal(r) === sal(t))).toHaveLength(1)
      expect(q.choices[q.answer - 1], `seed ${q.seed}`).toBe(String(expected))
    }
    expect([...seen].sort()).toEqual(['DENSE_RANK', 'RANK', 'ROW_NUMBER'])
  })

  it('TP08: 누적 합계를 JS로 계산한 값과 같다 (같은 값은 함께 누적 = RANGE)', async () => {
    for (const q of await generated('TP08')) {
      const tb = q.tables?.[0]
      const rows = tb?.rows ?? []
      const col = (name: string) => tb?.columns.indexOf(name) ?? -1
      const t = rows.find((r) => r[col('ENAME')] === targetOf(q)?.name)!
      const sal = (r: CellValue[]) => r[col('SAL')] as number
      const expected = (q.sql ?? '').includes('PARTITION BY')
        ? rows.filter((r) => r[col('DEPTNO')] === t[col('DEPTNO')] && (r[0] as number) <= (t[0] as number)).reduce((s, r) => s + sal(r), 0)
        : rows.filter((r) => sal(r) <= sal(t)).reduce((s, r) => s + sal(r), 0)
      expect(q.choices[q.answer - 1], `seed ${q.seed}`).toBe(String(expected))
    }
  })

  it('TP09: ROWNUM·인라인 뷰·FETCH FIRST 결과를 JS로 계산한 목록과 같다', async () => {
    const kinds = new Set<string>()
    for (const q of await generated('TP09')) {
      const sql = q.sql ?? ''
      const rows = q.tables?.[0]?.rows ?? [] // 저장 순서 = 표 순서
      const desc = sql.includes('SAL DESC')
      const n = Number(/ROWNUM <= (\d)|FETCH FIRST (\d)/.exec(sql)?.slice(1).find(Boolean))
      const bySal = (a: CellValue[], b: CellValue[]) => ((a[2] as number) - (b[2] as number)) * (desc ? -1 : 1)
      const kind = sql.includes('FETCH FIRST') ? 'fetch' : sql.includes('FROM (SELECT') ? 'inline' : 'rownum'
      kinds.add(kind)
      const picked = kind === 'rownum' ? rows.slice(0, n).sort(bySal) : [...rows].sort(bySal).slice(0, n)
      expect(q.choices[q.answer - 1], `${kind} seed ${q.seed}`).toBe(picked.map((r) => r[1]).join(', '))
      // 급여가 서로 달라야 결과가 하나로 정해진다
      expect(new Set(rows.map((r) => r[2])).size).toBe(rows.length)
    }
    expect([...kinds].sort()).toEqual(['fetch', 'inline', 'rownum'])
  })

  it('TP10: 두 변형(ROLLBACK TO 후 COMMIT / COMMIT 뒤 ROLLBACK)이 모두 나오고, 해설에 최종 테이블이 들어간다', async () => {
    const list = await generated('TP10')
    expect(list.some((q) => q.sql?.includes('ROLLBACK TO SAVEPOINT'))).toBe(true)
    expect(list.some((q) => /^ROLLBACK;$/m.test(q.sql ?? ''))).toBe(true)
    for (const q of list) expect(q.explanation).toContain('**모든 문장을 실행한 뒤의 EMP**')
  })
})

// ───────────── T8-15: TP11~TP18 ─────────────

describe('T8-15 템플릿별 세부 규칙', () => {
  it('TP11: 세 변형(SUBSTR·INSTR·REPLACE)이 모두 나온다', async () => {
    const sqls = (await generated('TP11')).map((q) => q.sql ?? '')
    expect(sqls.some((s) => /SUBSTR\(CODE, \d, \d\)/.test(s))).toBe(true)
    expect(sqls.some((s) => s.includes('INSTR'))).toBe(true)
    expect(sqls.some((s) => s.includes('REPLACE'))).toBe(true)
  })

  it('TP12: CASE 경계값이 실제 급여에 있고, 두 변형(WHEN 순서·ELSE 없음)이 모두 나온다', async () => {
    const list = await generated('TP12')
    for (const q of list) {
      const sals = column(q.tables?.[0], 'SAL')
      for (const m of (q.sql ?? '').matchAll(/SAL >= (\d+)/g)) expect(sals).toContain(Number(m[1]))
    }
    expect(list.some((q) => q.sql?.includes("GRADE = 'B'"))).toBe(true)
    expect(list.some((q) => q.sql?.includes('GRADE IS NULL'))).toBe(true)
  })

  it('TP13: 첫 행을 JS로 계산한 값과 같다 (Oracle: NULL은 가장 큰 값)', async () => {
    const seen = new Set<string>()
    for (const q of await generated('TP13')) {
      const sql = q.sql ?? ''
      const desc = sql.includes('COMM DESC')
      const nulls = /NULLS (FIRST|LAST)/.exec(sql)?.[1] ?? (desc ? 'FIRST' : 'LAST')
      seen.add(`${desc ? 'DESC' : 'ASC'} ${nulls}`)
      const rows = [...(q.tables?.[0]?.rows ?? [])].sort((a, b) => {
        const [x, y] = [a[2] ?? null, b[2] ?? null]
        if (x === null || y === null) {
          if (x === y) return (a[0] as number) - (b[0] as number)
          return (x === null ? -1 : 1) * (nulls === 'FIRST' ? 1 : -1)
        }
        return ((x as number) - (y as number)) * (desc ? -1 : 1) || (a[0] as number) - (b[0] as number)
      })
      expect(q.choices[q.answer - 1], `seed ${q.seed}\n${sql}`).toBe(rows[0]?.[1])
    }
    expect(seen.size).toBe(4)
  })

  it('TP14: 경계값과 같은 급여가 있고, 결과 건수가 JS 계산과 같다', async () => {
    for (const q of await generated('TP14')) {
      const emp = q.tables?.[0]?.rows ?? []
      const grades = q.tables?.[1]?.rows ?? []
      const edges = grades.flatMap((g) => [g[1], g[2]])
      expect(emp.some((e) => edges.includes(e[2] ?? null))).toBe(true)
      const g = Number(/S\.GRADE = (\d)/.exec(q.sql ?? '')?.[1] ?? 0)
      const expected = emp.flatMap((e) =>
        grades.filter((s) => (!g || s[0] === g) && (e[2] as number) >= (s[1] as number) && (e[2] as number) <= (s[2] as number)),
      ).length
      expect(q.choices[q.answer - 1], `seed ${q.seed}`).toBe(`${expected}건`)
    }
  })

  it('TP15: ROLLUP·CUBE·GROUPING SETS 행 수가 JS 계산과 같다', async () => {
    const seen = new Set<string>()
    for (const q of await generated('TP15')) {
      const rows = q.tables?.[0]?.rows ?? []
      const pairs = new Set(rows.map((r) => `${r[1]}|${r[2]}`)).size
      const depts = new Set(rows.map((r) => r[1])).size
      const jobs = new Set(rows.map((r) => r[2])).size
      const kind = /GROUP BY (ROLLUP|CUBE|GROUPING SETS)/.exec(q.sql ?? '')?.[1] ?? ''
      seen.add(kind)
      const expected = ({ ROLLUP: pairs + depts + 1, CUBE: pairs + depts + jobs + 1, 'GROUPING SETS': depts + jobs } as Record<string, number>)[kind]
      expect(q.choices[q.answer - 1], `${kind} seed ${q.seed}`).toBe(`${expected}건`)
    }
    expect([...seen].sort()).toEqual(['CUBE', 'GROUPING SETS', 'ROLLUP'])
  })

  it('TP16: 계층형 질의 결과 건수가 JS 트리 계산과 같다 (순방향·LEVEL·역방향)', async () => {
    const seen = new Set<string>()
    for (const q of await generated('TP16')) {
      const sql = q.sql ?? ''
      const rows = q.tables?.[0]?.rows ?? []
      const startName = /ENAME = '(\w+)'/.exec(sql)?.[1]
      const start = startName ? rows.filter((r) => r[1] === startName) : rows.filter((r) => r[2] === null)
      let expected = 0
      if (sql.includes('PRIOR MGR = EMPNO')) {
        seen.add('up')
        for (let r: CellValue[] | undefined = start[0]; r; ) {
          expected++
          const mgr: CellValue = r[2] ?? null
          r = rows.find((x) => x[0] === mgr)
        }
      } else {
        const levels: number[] = []
        const walk = (r: CellValue[], lv: number) => {
          levels.push(lv)
          for (const k of rows.filter((x) => x[2] === r[0])) walk(k, lv + 1)
        }
        for (const r of start) walk(r, 1)
        const lv = /WHERE LEVEL = (\d+)/.exec(sql)?.[1]
        seen.add(lv ? 'level' : 'down')
        expected = lv ? levels.filter((x) => x === Number(lv)).length : levels.length
      }
      expect(q.choices[q.answer - 1], `seed ${q.seed}\n${sql}`).toBe(`${expected}건`)
    }
    expect([...seen].sort()).toEqual(['down', 'level', 'up'])
  })

  it('TP17: 두 변형(부서 평균 비교·EXISTS)이 모두 나오고, 사원이 없는 부서가 있다', async () => {
    const list = await generated('TP17')
    for (const q of list) {
      const used = new Set(column(q.tables?.[0], 'DEPTNO'))
      expect(column(q.tables?.[1], 'DEPTNO').some((d) => !used.has(d))).toBe(true)
    }
    expect(list.some((q) => q.sql?.includes('AVG(SAL)'))).toBe(true)
    expect(list.some((q) => q.sql?.includes('EXISTS'))).toBe(true)
  })

  it('TP18: 해설에 최종 테이블이 들어가고, DELETE 조건 두 방향이 모두 나온다', async () => {
    const list = await generated('TP18')
    for (const q of list) expect(q.explanation).toContain('**모든 문장을 실행한 뒤의 EMP**')
    expect(list.some((q) => /SAL >= \d+;/.test(q.sql ?? ''))).toBe(true)
    expect(list.some((q) => /SAL < \d+;/.test(q.sql ?? ''))).toBe(true)
  })
})
