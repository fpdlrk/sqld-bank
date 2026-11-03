/**
 * 문제 본문·해설용 작은 Markdown 해석기 (T3-1)
 *
 * 지원: 문단(줄바꿈 유지), "- " 목록, "1. " 목록, 표(| a | b |), ``` 코드블록,
 *       **굵게**, `인라인 코드`
 * 일부러 지원하지 않는 것:
 *   - *기울임* : SQL의 COUNT(*), SELECT * 와 헷갈리기 때문
 *   - HTML·링크·이미지 : 문제 콘텐츠에 필요 없고, HTML을 그대로 넣지 않아야 안전하다
 * 라이브러리를 쓰지 않은 이유: 필요한 문법이 적고, 앱 크기를 늘리지 않기 위해.
 */

export type MdBlock =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'code'; lang: string; code: string }

export type MdInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: MdInline[] }
  | { type: 'code'; text: string }

const UL = /^\s*- (.*)$/
const OL = /^\s*\d+\. (.*)$/
const FENCE = /^\s*```\s*([\w-]*)\s*$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (line.trim() === '') {
      i++
      continue
    }

    // 코드블록 — 닫는 ``` 가 없으면 끝까지 코드로 본다
    const fence = FENCE.exec(line)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !FENCE.test(lines[i] ?? '')) body.push(lines[i++] ?? '')
      i++ // 닫는 ```
      blocks.push({ type: 'code', lang: fence[1] ?? '', code: body.join('\n') })
      continue
    }

    // 표 — 머리줄 다음 줄이 |---|---| 일 때만 표로 본다
    if (TABLE_ROW.test(line) && TABLE_SEP.test(lines[i + 1] ?? '')) {
      const columns = splitRow(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && TABLE_ROW.test(lines[i] ?? '')) rows.push(splitRow(lines[i++] ?? ''))
      blocks.push({ type: 'table', columns, rows })
      continue
    }

    // 목록 — 같은 종류의 항목이 이어지는 동안 하나의 목록
    const ordered = OL.test(line)
    if (ordered || UL.test(line)) {
      const pattern = ordered ? OL : UL
      const items: string[] = []
      while (i < lines.length) {
        const m = pattern.exec(lines[i] ?? '')
        if (!m) break
        items.push(m[1] ?? '')
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    // 문단 — 빈 줄이나 다른 블록이 나올 때까지
    const para: string[] = []
    while (i < lines.length) {
      const l = lines[i] ?? ''
      if (l.trim() === '' || FENCE.test(l) || UL.test(l) || OL.test(l)) break
      if (TABLE_ROW.test(l) && TABLE_SEP.test(lines[i + 1] ?? '')) break
      para.push(l.trim())
      i++
    }
    blocks.push({ type: 'paragraph', lines: para })
  }

  return blocks
}

// `코드`를 먼저 찾아야 코드 안의 ** 를 굵게로 오해하지 않는다
const INLINE = /`([^`]+)`|\*\*(.+?)\*\*/g

export function parseInline(text: string): MdInline[] {
  const out: MdInline[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ type: 'code', text: m[1] })
    else out.push({ type: 'strong', children: parseInline(m[2] ?? '') })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) })
  return out
}
