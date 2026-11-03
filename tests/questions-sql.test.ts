// @vitest-environment node
// ↑ sql.js(WASM)는 Node 환경에서 파일로 바로 읽히므로 이 테스트만 jsdom 대신 node 환경으로 돌린다.
import { describe, it, expect, beforeAll } from 'vitest'
import initSqlJs from 'sql.js'
import type { SqlJsStatic } from 'sql.js'
import type { CellValue, Question } from '../src/domain'

/**
 * 고정 문제 정답 실행 검증 (docs/04 §5 verify)
 *
 * verify.executable = true 인 문제마다
 *   1) tables 로 테이블을 만들고 행을 넣는다
 *   2) sqlExec(없으면 sql)를 실행해 마지막 결과를 얻는다
 *   3) verify.expect 방식으로 정답 보기와 대조한다
 *      - rowCount : 결과 행 수 = 정답 보기 속 첫 숫자          (예: "3건")
 *      - value    : 첫 행의 값들을 ", "로 이은 문자열 = 정답 보기 (NULL은 "NULL")
 */
const files = import.meta.glob<Question[]>('/src/data/questions/*.json', {
  eager: true,
  import: 'default',
})
const executable = Object.values(files)
  .flat()
  .filter((q) => q.verify?.executable)

let SQL: SqlJsStatic
beforeAll(async () => {
  SQL = await initSqlJs()
})

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`
const firstNumber = (text: string) => Number(/-?\d+(\.\d+)?/.exec(text)?.[0] ?? NaN)
const cellText = (v: CellValue | Uint8Array) => (v === null ? 'NULL' : String(v))

function run(q: Question) {
  const db = new SQL.Database()
  try {
    for (const t of q.tables ?? []) {
      if (!t.name) throw new Error('실행 검증 문제의 테이블에는 name이 필요합니다')
      db.run(`CREATE TABLE ${quote(t.name)} (${t.columns.map(quote).join(', ')})`)
      const insert = `INSERT INTO ${quote(t.name)} VALUES (${t.columns.map(() => '?').join(', ')})`
      for (const row of t.rows) db.run(insert, row)
    }
    const results = db.exec(q.sqlExec ?? q.sql ?? '')
    const last = results[results.length - 1]
    return last ? last.values : []
  } finally {
    db.close()
  }
}

describe('T2-4 고정 문제 정답 실행 검증 (sql.js)', () => {
  it('실행 검증 대상 문제가 있다', () => {
    expect(executable.length).toBeGreaterThan(0)
  })

  it.each(executable.map((q) => [q.id, q] as const))('%s', (_id, q) => {
    const rows = run(q)
    const correct = q.choices[q.answer - 1] ?? ''

    switch (q.verify?.expect) {
      case 'rowCount':
        expect(rows.length, `결과 ${rows.length}행 ↔ 정답 보기 "${correct}"`).toBe(firstNumber(correct))
        break
      case 'value': {
        const actual = (rows[0] ?? []).map(cellText).join(', ')
        expect(actual, `실행 결과 "${actual}" ↔ 정답 보기 "${correct}"`).toBe(correct)
        break
      }
      default:
        throw new Error(`verify.expect(${String(q.verify?.expect)})는 아직 지원하지 않습니다. rowCount 또는 value를 쓰세요.`)
    }
  })
})
