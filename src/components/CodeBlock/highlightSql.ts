/**
 * 아주 작은 SQL 하이라이터 (라이브러리 없이)
 *
 * 문자열을 토큰 배열로 쪼개기만 하고, 색칠은 CodeBlock이 CSS로 한다.
 * 완벽한 SQL 파서가 아니라 "시험 문제에 나오는 SQL이 읽기 좋게 보이는 것"이 목표.
 * 토큰을 다시 이어 붙이면 원문과 정확히 같아야 한다 (공백·줄바꿈 보존).
 */
export type SqlTokenType = 'keyword' | 'function' | 'string' | 'number' | 'comment' | 'plain'

export interface SqlToken {
  type: SqlTokenType
  text: string
}

// 시험 범위(Oracle SQL)에서 자주 나오는 예약어
const KEYWORDS = new Set(
  `SELECT FROM WHERE AND OR NOT IN IS NULL AS DISTINCT ALL ANY SOME EXISTS BETWEEN LIKE ESCAPE
  GROUP BY HAVING ORDER ASC DESC NULLS FIRST LAST JOIN INNER LEFT RIGHT FULL OUTER CROSS NATURAL
  ON USING UNION INTERSECT MINUS EXCEPT CASE WHEN THEN ELSE END OVER PARTITION ROWS RANGE
  UNBOUNDED PRECEDING FOLLOWING CURRENT ROW WITH RECURSIVE START CONNECT PRIOR NOCYCLE SIBLINGS
  LEVEL ROWNUM FETCH NEXT ONLY TIES OFFSET INSERT INTO VALUES UPDATE SET DELETE MERGE MATCHED
  CREATE ALTER DROP TRUNCATE RENAME TABLE VIEW INDEX SEQUENCE ADD MODIFY COLUMN CONSTRAINT
  PRIMARY FOREIGN KEY REFERENCES UNIQUE CHECK DEFAULT CASCADE COMMIT ROLLBACK SAVEPOINT GRANT
  REVOKE TO PUBLIC ROLE PIVOT UNPIVOT FOR ROLLUP CUBE GROUPING SETS DUAL TRUE FALSE`.split(/\s+/),
)

// 순서가 중요하다: 앞에서부터 처음 맞는 규칙을 쓴다
const RULES: [SqlTokenType | 'word', RegExp][] = [
  ['comment', /^--[^\n]*/],
  ['comment', /^\/\*[\s\S]*?(\*\/|$)/],
  ['string', /^'(?:[^']|'')*'?/], // Oracle은 '' 로 작은따옴표를 이스케이프
  ['plain', /^"[^"]*"?/], // "따옴표 식별자"는 색칠하지 않음
  ['number', /^\d+(\.\d+)?/],
  ['word', /^[A-Za-z_][A-Za-z0-9_$#]*/],
  ['plain', /^\s+/],
  ['plain', /^./],
]

export function highlightSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = []
  let rest = sql

  while (rest.length > 0) {
    for (const [type, re] of RULES) {
      const m = re.exec(rest)
      if (!m) continue
      const text = m[0]
      rest = rest.slice(text.length)

      if (type === 'word') {
        if (KEYWORDS.has(text.toUpperCase())) push(tokens, 'keyword', text)
        // 단어 바로 뒤(공백 허용)에 ( 가 오면 함수로 본다: NVL(…), COUNT (*)
        else if (/^\s*\(/.test(rest)) push(tokens, 'function', text)
        else push(tokens, 'plain', text)
      } else {
        push(tokens, type, text)
      }
      break
    }
  }
  return tokens
}

/** 같은 종류가 이어지면 하나로 합쳐 DOM 노드 수를 줄인다 */
function push(tokens: SqlToken[], type: SqlTokenType, text: string) {
  const last = tokens[tokens.length - 1]
  if (last && last.type === type) last.text += text
  else tokens.push({ type, text })
}
