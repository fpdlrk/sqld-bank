import { describe, it, expect } from 'vitest'
import { formatProblem, validateQuestionFiles } from '../src/domain/questionSchema'

/** 정상 문제 1개 (아래 테스트에서 일부만 망가뜨려 쓴다) */
const valid = {
  id: 'S1-05-0001',
  subject: 2,
  chapter: 'S1-05',
  topic: 'COUNT(*)와 COUNT(컬럼)',
  type: 'sql_result',
  difficulty: 2,
  stem: '결과로 알맞은 것은?',
  tables: [{ name: 'EMP', columns: ['ID', 'BONUS'], rows: [[1, 100], [2, null]] }],
  sql: 'SELECT COUNT(*), COUNT(BONUS) FROM EMP;',
  choices: ['2, 1', '2, 2', '1, 1', '1, 2'],
  answer: 1,
  explanation: '정답은 ①입니다.',
  examPoint: 'COUNT(컬럼)은 NULL을 세지 않는다.',
  source: 'claude',
  verify: { executable: true },
}

const check = (questions: unknown[], file = 'S1-05.json') =>
  validateQuestionFiles({ [`/src/data/questions/${file}`]: questions }).map(formatProblem)

describe('T2-3 실제 문제 파일 검사', () => {
  it('src/data/questions/*.json 이 모두 규칙을 지킨다', () => {
    const files = import.meta.glob('/src/data/questions/*.json', { eager: true, import: 'default' })
    const problems = validateQuestionFiles(files).map(formatProblem)

    // 실패하면 어느 파일·몇 번째 문제·어느 필드가 왜 틀렸는지 전부 출력한다
    if (problems.length > 0) {
      throw new Error(`문제 JSON 오류 ${problems.length}건\n  - ${problems.join('\n  - ')}`)
    }
    expect(problems).toEqual([])
  })
})

describe('T2-3 스키마 규칙 (일부러 틀린 데이터)', () => {
  it('정상 문제는 통과한다', () => {
    expect(check([valid])).toEqual([])
  })

  it.each([
    ['보기가 3개', { choices: ['a', 'b', 'c'] }, 'choices: 보기는 정확히 4개'],
    ['보기 중복', { choices: ['a', 'b', 'a ', 'd'] }, 'choices: 보기 4개가 서로 달라야'],
    ['정답 범위 밖', { answer: 5 }, 'answer: 정답은 1~4'],
    ['필수 필드 누락', { explanation: undefined }, 'explanation:'],
    ['빈 해설', { explanation: '  ' }, 'explanation: 해설(explanation)이(가) 비어 있습니다'],
    ['없는 단원 코드', { chapter: 'S1-99' }, 'chapter: docs/04 §2 단원 코드표에 없는'],
    ['과목-단원 불일치', { subject: 1 }, 'subject: 단원 S1-05은(는) 2과목'],
    ['ID 형식', { id: 'S1-05-3' }, 'id: ID 형식은'],
    ['ID와 단원 불일치', { id: 'S1-04-0001' }, 'id: ID는 "S1-05-"로 시작'],
    ['오타 필드', { anwser: 1 }, '인식할 수 없는 키: "anwser"'],
    ['잘못된 유형', { type: 'essay' }, 'type: 유형은'],
    ['표 행 길이', { tables: [{ name: 'T', columns: ['A', 'B'], rows: [[1]] }] }, 'tables.0.rows.0: 1번째 행의 값 개수(1)'],
    ['실행 검증인데 SQL 없음', { sql: undefined }, 'verify: verify.executable이 true면'],
  ])('%s → 실패', (_name, patch, expected) => {
    const broken = { ...valid, ...patch }
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete (broken as Record<string, unknown>)[k]
    const problems = check([broken])
    expect(problems.join('\n')).toContain(expected)
    // 어느 파일·몇 번째 문제인지도 함께 나온다
    expect(problems[0]).toMatch(/^S1-05\.json \[1번째/)
  })

  it('오류가 여러 개면 하나에서 멈추지 않고 전부 보고한다', () => {
    const problems = check([{ ...valid, choices: ['a', 'b', 'a', 'd'], answer: 5, subject: 1 }]).join('\n')
    expect(problems).toContain('보기 4개가 서로 달라야')
    expect(problems).toContain('정답은 1~4')
    expect(problems).toContain('2과목입니다')
  })

  it('ID 중복을 파일을 넘어서도 잡는다', () => {
    const problems = validateQuestionFiles({
      '/x/S1-05.json': [valid],
      '/x/S1-04.json': [{ ...valid, chapter: 'S1-04', id: 'S1-05-0001' }],
    }).map(formatProblem)
    expect(problems.join('\n')).toContain('ID가 중복됩니다 (처음 나온 곳: S1-05.json 1번째)')
  })

  it('파일 이름과 단원 코드가 다르면 잡는다', () => {
    expect(check([valid], 'S1-04.json').join('\n')).toContain('파일 이름(S1-04)과 다릅니다')
    expect(check([valid], 'misc.json').join('\n')).toContain('파일 이름은 단원 코드여야')
  })

  it('직접 추가 문제는 U- 접두어가 필요하다', () => {
    expect(check([{ ...valid, source: 'user' }]).join('\n')).toContain('"U-S1-05-"로 시작')
    expect(check([{ ...valid, source: 'user', id: 'U-S1-05-0001' }])).toEqual([])
  })
})
