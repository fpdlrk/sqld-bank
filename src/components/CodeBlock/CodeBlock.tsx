import { useMemo } from 'react'
import { highlightSql } from './highlightSql'
import styles from './CodeBlock.module.css'

interface Props {
  code: string
  /** 지금은 SQL만 하이라이트한다. 'text'면 색칠 없이 보여 준다. */
  language?: 'sql' | 'text'
  /** 코드 위에 붙는 작은 제목 (예: "실행 SQL") */
  caption?: string
}

/** SQL 코드 박스. 긴 줄은 줄바꿈하지 않고 박스 안에서만 가로 스크롤된다. */
export function CodeBlock({ code, language = 'sql', caption }: Props) {
  const tokens = useMemo(
    () => (language === 'sql' ? highlightSql(code) : [{ type: 'plain' as const, text: code }]),
    [code, language],
  )

  return (
    <figure className={styles.figure}>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
      <pre className={`${styles.pre} scroll-x`} tabIndex={0}>
        <code>
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
      </pre>
    </figure>
  )
}
