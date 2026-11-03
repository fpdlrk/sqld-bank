import { useMemo } from 'react'
import { highlightSql } from './highlightSql'
import styles from './CodeBlock.module.css'

/**
 * 보기 안의 SQL처럼 글 흐름 속에 들어가는 SQL (T3-1)
 * 코드박스와 같은 색을 쓰지만, 좁은 화면에서는 줄바꿈된다.
 */
export function InlineSql({ code }: { code: string }) {
  const tokens = useMemo(() => highlightSql(code), [code])
  return (
    <code className={styles.inline}>
      {tokens.map((t, i) =>
        t.type === 'plain' ? (
          t.text
        ) : (
          <span key={i} className={styles[t.type]}>
            {t.text}
          </span>
        ),
      )}
    </code>
  )
}

const SQL_START = /^\s*(SELECT|INSERT|UPDATE|DELETE|MERGE|WITH|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMIT|ROLLBACK|SAVEPOINT)\b/i

/** 보기 글이 SQL 문장인지 (SQL 문장 보기는 고정폭 글꼴로 보여 준다) */
export function looksLikeSql(text: string): boolean {
  return SQL_START.test(text)
}
