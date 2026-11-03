import { Fragment, useMemo } from 'react'
import type { CellValue } from '../../domain'
import { CodeBlock } from '../CodeBlock/CodeBlock'
import { DataTable } from '../DataTable/DataTable'
import { parseInline, parseMarkdown, type MdInline } from './parseMarkdown'
import styles from './Markdown.module.css'

interface Props {
  source: string
  /** 'lg' = 문제 본문(18px), 'base' = 해설 등 */
  size?: 'base' | 'lg'
}

/** 문제 본문·해설 표시. 지원 문법은 parseMarkdown.ts 참고 */
export function Markdown({ source, size = 'base' }: Props) {
  const blocks = useMemo(() => parseMarkdown(source), [source])

  return (
    <div className={`${styles.md} ${styles[size]}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'paragraph':
            return (
              <p key={i}>
                {b.lines.map((line, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    <Inline text={line} />
                  </Fragment>
                ))}
              </p>
            )
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul'
            return (
              <Tag key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
                  </li>
                ))}
              </Tag>
            )
          }
          case 'table':
            // 해설 표도 예시 테이블과 같은 모양으로 — "NULL"은 NULL 표시, 숫자는 오른쪽 정렬
            return <DataTable key={i} columns={b.columns} rows={b.rows.map((r) => r.map(toCell))} />
          case 'code':
            return <CodeBlock key={i} code={b.code} language={b.lang.toLowerCase() === 'sql' ? 'sql' : 'text'} />
        }
      })}
    </div>
  )
}

function toCell(text: string): CellValue {
  if (text === 'NULL') return null
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
  return text.replace(/\*\*|`/g, '')
}

/** 한 줄 안의 굵게·코드 */
export function Inline({ text }: { text: string }) {
  return <>{renderInline(parseInline(text))}</>
}

function renderInline(nodes: MdInline[]) {
  return nodes.map((n, i) => {
    if (n.type === 'text') return <Fragment key={i}>{n.text}</Fragment>
    if (n.type === 'code') return <code key={i} className={styles.code}>{n.text}</code>
    return <strong key={i}>{renderInline(n.children)}</strong>
  })
}
