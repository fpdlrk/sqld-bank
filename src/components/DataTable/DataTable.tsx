import styles from './DataTable.module.css'

/** 표 한 칸의 값. 문제 JSON의 rows와 같은 형태 (NULL은 null) */
export type CellValue = string | number | null

interface Props {
  /** 테이블 이름 (예: "EMP"). 있으면 [EMP] 형태로 위에 표시 */
  name?: string
  columns: string[]
  rows: CellValue[][]
  /** 결과 표처럼 이름 대신 쓰는 설명 (예: "실행 결과") */
  caption?: string
}

/**
 * 예시 테이블·실행 결과 표
 * - NULL은 빈칸이 아니라 흐린 "NULL" 글자로 보여 준다 (빈 문자열과 구분하기 위해)
 * - 숫자는 오른쪽 정렬
 * - 칸이 많으면 표 박스 안에서만 가로 스크롤
 */
export function DataTable({ name, columns, rows, caption }: Props) {
  const title = caption ?? (name ? `[${name}]` : undefined)

  return (
    <figure className={styles.figure}>
      {title && <figcaption className={styles.caption}>{title}</figcaption>}
      <div className={`${styles.scroll} scroll-x`} tabIndex={0}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} scope="col">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.empty}>
                  (결과 없음 — 0행)
                </td>
              </tr>
            ) : (
              rows.map((row, r) => (
                <tr key={r}>
                  {columns.map((col, c) => {
                    const value = row[c] ?? null
                    if (value === null) {
                      return (
                        <td key={col} className={styles.null}>
                          NULL
                        </td>
                      )
                    }
                    return (
                      <td key={col} className={typeof value === 'number' ? styles.num : undefined}>
                        {value}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
