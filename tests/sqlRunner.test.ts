// @vitest-environment node
// ↑ sql.js(WASM)를 Node에서 파일로 바로 읽기 위해 node 환경. 앱에서는 브라우저용 로더가 쓰인다.
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import initSqlJs from 'sql.js'
import type { TableData } from '../src/domain'
import {
  getSqlEngineStatus,
  loadSqlEngine,
  onSqlEngineStatus,
  openDatabase,
  setSqlEngineLoader,
  withDatabase,
  type SqlEngineStatus,
} from '../src/engine'

let loads = 0
const nodeLoader = () => {
  loads++
  return initSqlJs()
}

beforeEach(() => {
  loads = 0
  setSqlEngineLoader(nodeLoader)
})
afterAll(() => setSqlEngineLoader(undefined))

const EMP: TableData = {
  name: 'EMP',
  columns: ['EMPNO', 'DEPTNO', 'SAL', 'COMM'],
  rows: [
    [1, 10, 1000, null],
    [2, 10, 2000, 100],
    [3, 20, 1500, null],
    [4, 20, 500, 0],
  ],
}

describe('T4-2 WASM 불러오기', () => {
  it('여러 번 열어도 실제 로딩은 한 번, 상태는 idle → loading → ready', async () => {
    const seen: SqlEngineStatus[] = []
    const off = onSqlEngineStatus((s) => seen.push(s))
    expect(getSqlEngineStatus()).toBe('idle')
    await Promise.all([openDatabase(), openDatabase(), loadSqlEngine()]).then((dbs) =>
      dbs.forEach((d) => 'close' in d && d.close()),
    )
    await openDatabase().then((d) => d.close())
    off()
    expect(loads).toBe(1)
    expect(seen).toEqual(['loading', 'ready'])
    expect(getSqlEngineStatus()).toBe('ready')
  })

  it('실패하면 error 상태가 되고, 다시 부르면 재시도한다', async () => {
    let fail = true
    setSqlEngineLoader(() => (fail ? Promise.reject(new Error('네트워크 끊김')) : initSqlJs()))
    await expect(loadSqlEngine()).rejects.toThrow('SQL 실행기를 불러오지 못했습니다: 네트워크 끊김')
    expect(getSqlEngineStatus()).toBe('error')
    fail = false
    await expect(loadSqlEngine()).resolves.toBeDefined()
    expect(getSqlEngineStatus()).toBe('ready')
  })
})

describe('T4-2 쿼리 실행', () => {
  it('테이블을 만들고 결과를 TableData로 — NULL·숫자 그대로', async () => {
    const r = await withDatabase([EMP], (db) =>
      db.query('SELECT DEPTNO, SUM(SAL + COMM) AS S, COUNT(COMM) AS C FROM EMP GROUP BY DEPTNO ORDER BY DEPTNO'),
    )
    expect(r).toEqual({ columns: ['DEPTNO', 'S', 'C'], rows: [[10, 2100, 1], [20, 500, 1]] })
  })

  it('NULL 값이 null로 돌아온다', async () => {
    const r = await withDatabase([EMP], (db) => db.query('SELECT EMPNO, COMM FROM EMP WHERE COMM IS NULL ORDER BY EMPNO'))
    expect(r.rows).toEqual([[1, null], [3, null]])
  })

  it('결과가 0행이어도 컬럼 이름은 남는다', async () => {
    const r = await withDatabase([EMP], (db) => db.query('SELECT EMPNO, SAL FROM EMP WHERE SAL > 99999'))
    expect(r).toEqual({ columns: ['EMPNO', 'SAL'], rows: [] })
  })

  it('여러 문장: 중간의 UPDATE도 반영되고, 결과를 내는 문장마다 표 하나', async () => {
    const all = await withDatabase([EMP], (db) =>
      db.queryAll(`SELECT COUNT(*) AS N FROM EMP;
        UPDATE EMP SET SAL = SAL * 2 WHERE DEPTNO = 10;
        SELECT SUM(SAL) AS T FROM EMP;`),
    )
    expect(all).toEqual([
      { columns: ['N'], rows: [[4]] },
      { columns: ['T'], rows: [[8000]] },
    ])
  })

  it('query는 마지막 결과를 돌려주고, 결과 문장이 없으면 오류', async () => {
    await withDatabase([EMP], (db) => {
      db.run('DELETE FROM EMP WHERE EMPNO = 1')
      expect(db.query('SELECT 1 AS A; SELECT COUNT(*) AS N FROM EMP').rows).toEqual([[3]])
      expect(() => db.query('DELETE FROM EMP')).toThrow('결과를 돌려주는 문장(SELECT)이 없습니다')
    })
  })

  it('문법 오류는 한국어 안내 + 실행한 SQL을 함께 보여 준다', async () => {
    await withDatabase([EMP], (db) => {
      expect(() => db.query('SELEC * FROM EMP')).toThrow(/SQL 실행 오류: .*syntax error[\s\S]*SELEC \* FROM EMP/)
      expect(() => db.query('SELECT * FROM NOPE')).toThrow(/no such table: NOPE/)
    })
  })

  it('테이블 이름이 없으면 만들 수 없다', async () => {
    await expect(openDatabase([{ columns: ['A'], rows: [[1]] }])).rejects.toThrow('name이 필요합니다')
  })

  it('이름에 공백·따옴표가 있어도 만들어진다', async () => {
    const r = await withDatabase([{ name: '실행 결과', columns: ['A "X"'], rows: [[1]] }], (db) =>
      db.query('SELECT * FROM "실행 결과"'),
    )
    expect(r).toEqual({ columns: ['A "X"'], rows: [[1]] })
  })

  it('withDatabase는 끝나면 DB를 닫는다 (오류가 나도)', async () => {
    let kept: { query: (s: string) => unknown } | undefined
    await withDatabase([EMP], (db) => {
      kept = db
    })
    expect(() => kept!.query('SELECT 1')).toThrow()
    await expect(
      withDatabase([EMP], (db) => {
        kept = db
        throw new Error('템플릿 오류')
      }),
    ).rejects.toThrow('템플릿 오류')
    expect(() => kept!.query('SELECT 1')).toThrow()
  })

  it('DB마다 따로 — 한 DB에서 바꾼 내용이 다른 DB에 보이지 않는다', async () => {
    const a = await openDatabase([EMP])
    const b = await openDatabase([EMP])
    a.run('DELETE FROM EMP')
    expect(a.query('SELECT COUNT(*) FROM EMP').rows).toEqual([[0]])
    expect(b.query('SELECT COUNT(*) FROM EMP').rows).toEqual([[4]])
    a.close()
    b.close()
  })
})
