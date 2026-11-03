import { useEffect, useState } from 'react'
import { AnswerFeedback, Button, Card, QuestionView } from '../../components'
import type { ChoiceNumber, GeneratedQuestion } from '../../domain'
import { TEMPLATE_INFO, generateTemplateQuestion, randomSeed } from '../../engine'

const CHOICES = [...TEMPLATE_INFO, { id: 'DEMO', topic: '견본 (T4-3)' }]

/** 템플릿 코드는 문제를 만들 때 불러온다 (앱 첫 화면에 포함하지 않음, T4-7) */
async function generate(templateId: string, seed: number): Promise<GeneratedQuestion> {
  const q =
    templateId === 'DEMO'
      ? await import('./demoTemplate').then((m) => m.demoTemplate.generate(seed))
      : await generateTemplateQuestion(templateId, seed)
  if (!q) throw new Error(`템플릿 ${templateId}을(를) 찾을 수 없습니다`)
  return q
}

/** 임시 견본 (T4-3, T4-4) — 템플릿과 시드를 바꿔 가며 문제를 만들어 본다 */
export function TemplatePreview() {
  // 처음에는 만들지 않는다 — 버튼을 눌러야 SQL 실행기를 불러온다
  const [seed, setSeed] = useState<number | null>(null)
  const [templateId, setTemplateId] = useState(CHOICES[0]?.id ?? 'DEMO')
  const [question, setQuestion] = useState<GeneratedQuestion | null>(null)
  const [picked, setPicked] = useState<ChoiceNumber | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ms, setMs] = useState<number | null>(null)

  useEffect(() => {
    if (seed === null) return
    let alive = true
    const started = performance.now()
    setPicked(null)
    generate(templateId, seed)
      .then((q) => {
        if (!alive) return
        setQuestion(q)
        setError(null)
        setMs(Math.round(performance.now() - started))
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [seed, templateId])

  return (
    <Card title="템플릿 견본">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }}>
        <label>
          템플릿{' '}
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            style={{ minHeight: 'var(--tap-min)' }}
          >
            {CHOICES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} {t.topic}
              </option>
            ))}
          </select>
        </label>
        <label>
          시드{' '}
          <input
            type="number"
            value={seed ?? ''}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            style={{ width: '9rem', minHeight: 'var(--tap-min)' }}
          />
        </label>
        <Button variant="secondary" onClick={() => setSeed((s) => (s ?? 0) + 1)}>
          {seed === null ? '문제 만들기' : '다음 시드'}
        </Button>
        <Button variant="ghost" onClick={() => setSeed(randomSeed())}>
          무작위
        </Button>
        {ms !== null && <span>생성 {ms}ms (첫 회는 SQL 실행기 로딩 포함)</span>}
      </div>
      {error && <p role="alert">{error}</p>}
      {question && (
        <>
          <QuestionView
            question={question}
            selected={picked}
            onSelect={setPicked}
            {...(picked !== null && { answer: question.answer })}
          />
          {picked !== null && <AnswerFeedback question={question} chosen={picked} />}
        </>
      )}
    </Card>
  )
}
