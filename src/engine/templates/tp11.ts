/**
 * TP11 (S1-03) 문자 함수 결과 값 — docs/04 §7
 * 변형: SUBSTR(시작, 길이) / SUBSTR + INSTR로 앞부분 자르기 / LENGTH + REPLACE
 * INSTR은 2개 인자만 쓴다 (SQLite에 3·4번째 인자가 없음, docs/04 §6)
 */
import type { CellValue } from '../../domain'
import { defineTemplate, format, type TemplateScenario } from '../template'
import type { Rng } from '../rng'

const LETTERS = [...'ABCDEFGHJKLMNPRSTUVWXYZ']

function makeCode(rng: Rng): string {
  const word = (n: number) => Array.from({ length: n }, () => rng.pick(LETTERS)).join('')
  const digits = (n: number) => Array.from({ length: n }, () => String(rng.int(0, 9))).join('')
  return `${word(rng.int(2, 4))}-${digits(rng.int(3, 4))}-${word(rng.int(1, 2))}`
}

const value = (expr: string, id: number) => ({ sql: `SELECT ${expr} AS R FROM CODES WHERE ID = ${id}`, format: format.value })

interface Codes {
  rows: CellValue[][]
  id: number
  code: string
}

function base(codes: Codes, expr: string): Pick<TemplateScenario, 'tables' | 'stem' | 'sql'> {
  return {
    tables: [{ name: 'CODES', columns: ['ID', 'CODE'], rows: codes.rows }],
    stem: `다음 [CODES] 테이블에 SQL을 실행한 결과로 알맞은 것은?`,
    sql: `SELECT ${expr} AS R\n  FROM CODES\n WHERE ID = ${codes.id};`,
  }
}

function substr(rng: Rng, codes: Codes): TemplateScenario {
  const m = rng.int(2, 4)
  const n = rng.int(m + 1, m + 3)
  const expr = `SUBSTR(CODE, ${m}, ${n})`
  return {
    ...base(codes, expr),
    answer: value(expr, codes.id),
    traps: [
      { ...value(`SUBSTR(CODE, ${m + 1}, ${n})`, codes.id), why: '시작 위치를 0부터 센' },
      { ...value(`SUBSTR(CODE, ${m}, ${n - m + 1})`, codes.id), why: `세 번째 인수 ${n}을 "끝 위치"로 본` },
      { ...value(`SUBSTR(CODE, ${m})`, codes.id), why: '길이 인수를 무시하고 끝까지 자른' },
    ],
    fillers: [codes.code.slice(m - 2, m - 2 + n), codes.code.slice(m, m + n - 1)].filter((s) => s.trim() !== ''),
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. SUBSTR(문자열, 시작 위치, 길이)는 시작 위치부터 "길이"만큼 글자를 잘라 냅니다. 위치는 1부터 세므로 '${codes.code}'의 ${m}번째 글자부터 ${n}글자를 가져옵니다. 세 번째 인수는 끝 위치가 아니라 가져올 글자 수이고, 생략하면 문자열 끝까지 자릅니다.`,
    examPoint: 'SUBSTR(s, 시작, 길이) — 위치는 1부터, 세 번째 인수는 끝 위치가 아니라 글자 수(생략하면 끝까지).',
  }
}

function prefix(_rng: Rng, codes: Codes): TemplateScenario {
  const expr = `SUBSTR(CODE, 1, INSTR(CODE, '-') - 1)`
  const dash = codes.code.indexOf('-') + 1
  return {
    ...base(codes, expr),
    answer: value(expr, codes.id),
    traps: [
      { ...value(`SUBSTR(CODE, 1, INSTR(CODE, '-'))`, codes.id), why: "INSTR 결과에서 1을 빼지 않아 '-'까지 자른" },
      { ...value(`SUBSTR(CODE, INSTR(CODE, '-') + 1)`, codes.id), why: "'-' 뒤쪽을 자른다고 본" },
      { ...value(`SUBSTR(CODE, 2, INSTR(CODE, '-') - 1)`, codes.id), why: 'SUBSTR의 시작 위치 1을 두 번째 글자로 본' },
    ],
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. INSTR(CODE, '-')는 '${codes.code}'에서 처음 나오는 '-'의 위치 ${dash}를 돌려줍니다. 여기서 1을 빼면 '-' 바로 앞까지의 글자 수(${dash - 1})가 되므로, SUBSTR(CODE, 1, ${dash - 1})은 첫 번째 '-' 앞부분만 잘라 냅니다. 구분자 앞의 코드값을 꺼낼 때 자주 쓰는 조합입니다.`,
    examPoint: "SUBSTR(s, 1, INSTR(s, '-') - 1) = 첫 구분자 앞부분. INSTR은 1부터 센 위치, 없으면 0.",
  }
}

function lengthReplace(_rng: Rng, codes: Codes): TemplateScenario {
  const expr = `LENGTH(REPLACE(CODE, '-', ''))`
  return {
    ...base(codes, expr),
    answer: value(expr, codes.id),
    traps: [
      { ...value('LENGTH(CODE)', codes.id), why: 'REPLACE 전의 길이를 센' },
      { ...value(`LENGTH(CODE) - LENGTH(REPLACE(CODE, '-', ''))`, codes.id), why: "지워진 '-'의 개수를 센" },
      { ...value('LENGTH(CODE) - 1', codes.id), why: "REPLACE가 첫 번째 '-'만 지운다고 본" },
    ],
    explain: ({ answerMark, answerText }) =>
      `정답은 ${answerMark}(${answerText})입니다. REPLACE(CODE, '-', '')는 '${codes.code}' 안의 모든 '-'를 지웁니다(첫 번째만이 아님). 길이 ${codes.code.length}인 문자열에서 '-' 2개가 빠지므로 LENGTH는 ${codes.code.length - 2}입니다. Oracle에서 ''는 NULL과 같아서, 바꿀 문자열을 생략한 REPLACE(CODE, '-')도 같은 결과를 냅니다.`,
    examPoint: 'REPLACE(s, a, b)는 a를 모두 b로 바꾼다. 특정 문자 개수 = LENGTH(s) - LENGTH(REPLACE(s, 문자, \'\')).',
  }
}

export const TP11 = defineTemplate({
  id: 'TP11',
  subject: 2,
  chapter: 'S1-03',
  topic: '문자 함수 결과 값',
  type: 'sql_result',
  difficulty: 2,
  tags: ['문자 함수', 'SUBSTR', 'INSTR', 'REPLACE', 'LENGTH'],
  build(rng) {
    const n = rng.int(3, 5)
    const codeList = Array.from({ length: n }, () => makeCode(rng))
    const id = rng.int(1, n)
    const codes: Codes = { rows: codeList.map((c, i) => [i + 1, c]), id, code: codeList[id - 1] ?? '' }
    return rng.pick([substr, prefix, lengthReplace])(rng, codes)
  },
})
