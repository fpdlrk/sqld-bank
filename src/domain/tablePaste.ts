/**
 * 예시 테이블 붙여넣기 (T7-2)
 * 엑셀·구글 시트에서 범위를 복사하면 탭으로 구분된 글자가 된다. 쉼표(CSV)도 받는다.
 *   - 첫 줄 = 컬럼 이름
 *   - 빈 칸·"NULL"(대소문자 무관) → NULL
 *   - 숫자처럼 생긴 값 → 숫자 (앞에 0이 붙은 "007"은 글자로 둔다)
 */
import type { CellValue, TableData } from './types'

export type TableParse = { ok: true; table: TableData } | { ok: false; message: string }

const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?$/

function toCell(raw: string): CellValue {
  const v = raw.trim()
  if (v === '' || v.toUpperCase() === 'NULL') return null
  return NUMBER.test(v) ? Number(v) : v
}

export function parsePastedTable(text: string, name?: string): TableParse {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')
  if (lines.length === 0) return { ok: false, message: '붙여 넣은 내용이 없습니다' }

  const delimiter = lines[0]!.includes('\t') ? '\t' : ','
  const split = (l: string) => l.split(delimiter)
  const columns = split(lines[0]!).map((c) => c.trim())
  if (columns.some((c) => c === '')) return { ok: false, message: '첫 줄(컬럼 이름)에 빈 칸이 있습니다' }
  if (new Set(columns).size !== columns.length) return { ok: false, message: '컬럼 이름이 겹칩니다' }

  const rows: CellValue[][] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]!)
    // 엑셀은 맨 끝 빈 칸의 구분자를 빼기도 하므로 모자라면 NULL로 채운다
    if (cells.length > columns.length) {
      return { ok: false, message: `${i + 1}번째 줄의 칸 수(${cells.length})가 컬럼 수(${columns.length})보다 많습니다` }
    }
    rows.push(columns.map((_, c) => toCell(cells[c] ?? '')))
  }
  const trimmed = name?.trim()
  return { ok: true, table: trimmed ? { name: trimmed, columns, rows } : { columns, rows } }
}

/** 표 → 탭 구분 글자 (수정할 때 입력 칸에 다시 채워 넣기용). NULL은 "NULL"로 */
export function tableToText(table: TableData): string {
  const cell = (v: CellValue) => (v === null ? 'NULL' : String(v))
  return [table.columns.join('\t'), ...table.rows.map((r) => r.map(cell).join('\t'))].join('\n')
}
