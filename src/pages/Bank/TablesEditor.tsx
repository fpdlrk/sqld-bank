import { Button, DataTable } from '../../components'
import { parsePastedTable, type TableDraft } from '../../domain'
import styles from './Editor.module.css'

interface Props {
  tables: TableDraft[]
  onChange: (tables: TableDraft[]) => void
}

/**
 * 예시 테이블 입력 (T7-2)
 * 엑셀·구글 시트에서 범위를 복사해 붙여 넣으면 아래에 바로 표로 바뀐 모습이 보인다.
 */
export function TablesEditor({ tables, onChange }: Props) {
  const update = (i: number, patch: Partial<TableDraft>) =>
    onChange(tables.map((t, j) => (j === i ? { ...t, ...patch } : t)))

  return (
    <div className={styles.tables}>
      {tables.map((t, i) => {
        const parsed = t.text.trim() ? parsePastedTable(t.text, t.name) : null
        return (
          <fieldset key={i} className={styles.tableBox}>
            <legend>{i + 1}번째 예시 테이블</legend>
            <label className={styles.field}>
              <span>테이블 이름 (예: EMP)</span>
              <input className={styles.input} value={t.name} onChange={(e) => update(i, { name: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span>내용 — 엑셀에서 복사해 붙여 넣기 (첫 줄은 컬럼 이름, 빈 칸·NULL은 NULL)</span>
              <textarea
                className={`${styles.textarea} ${styles.mono}`}
                rows={5}
                value={t.text}
                spellCheck={false}
                placeholder={'EMPNO\tENAME\tSAL\n1\tKIM\t3000\n2\tLEE\tNULL'}
                onChange={(e) => update(i, { text: e.target.value })}
              />
            </label>
            {parsed && !parsed.ok && (
              <p className={styles.error} role="alert">
                {parsed.message}
              </p>
            )}
            {parsed?.ok && (
              <DataTable name={parsed.table.name} columns={parsed.table.columns} rows={parsed.table.rows} />
            )}
            <Button variant="ghost" onClick={() => onChange(tables.filter((_, j) => j !== i))}>
              이 표 삭제
            </Button>
          </fieldset>
        )
      })}
      <Button variant="secondary" onClick={() => onChange([...tables, { name: '', text: '' }])}>
        + 예시 테이블 추가
      </Button>
    </div>
  )
}
