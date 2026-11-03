import { useMemo, useState } from 'react'
import { Button, Card } from '../../components'
import {
  DIFFICULTY_LABELS,
  PARTS,
  QUESTION_TYPE_LABELS,
  chaptersOfPart,
  countByChapter,
  filterQuestions,
  filterTemplates,
  practiceItems,
  withSubjects,
  type ChapterCode,
  type Difficulty,
  type PracticeCount,
  type PracticeSettings,
  type ProgressFilter,
  type Question,
  type QuestionRef,
  type QuestionStat,
  type QuestionType,
  type Subject,
  type TemplateInfo,
} from '../../domain'
import { MultiChips, SingleChips, type ChipOption } from './OptionChips'
import styles from './PracticeSetup.module.css'

const SUBJECT_OPTIONS: ChipOption<Subject>[] = [
  { value: 1, label: '1과목 데이터 모델링' },
  { value: 2, label: '2과목 SQL' },
]
const TYPE_OPTIONS = (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((value) => ({
  value,
  label: QUESTION_TYPE_LABELS[value],
}))
const DIFFICULTY_OPTIONS = ([1, 2, 3] as Difficulty[]).map((value) => ({
  value,
  label: `${'★'.repeat(value)} ${DIFFICULTY_LABELS[value]}`,
}))
const PROGRESS_OPTIONS: ChipOption<ProgressFilter>[] = [
  { value: 'all', label: '전체' },
  { value: 'unsolved', label: '안 푼 문제만' },
  { value: 'wrong', label: '틀린 문제만' },
]
const COUNT_OPTIONS: ChipOption<PracticeCount>[] = [
  { value: 10, label: '10문제' },
  { value: 20, label: '20문제' },
  { value: 'all', label: '전체' },
]

interface Props {
  questions: Question[]
  /** 변형 문제(템플릿) 정보 — 없으면 고정 문제만 (T4-7) */
  templates?: readonly TemplateInfo[]
  stats: ReadonlyMap<QuestionRef, QuestionStat>
  initialSettings: PracticeSettings
  onStart: (settings: PracticeSettings) => void
  /** 변형 문제를 만드는 중이면 시작 버튼을 잠근다 */
  preparing?: boolean
}

const NO_TEMPLATES: readonly TemplateInfo[] = []

/** 단원별 연습 설정 (T3-3) — 조건을 바꿀 때마다 출제 가능 문항 수가 바로 바뀐다 */
export function PracticeSetup({ questions, templates = NO_TEMPLATES, stats, initialSettings, onStart, preparing = false }: Props) {
  const [settings, setSettings] = useState(initialSettings)
  const set = <K extends keyof PracticeSettings>(key: K, value: PracticeSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }))

  // 단원 옆 문제 수 — 유형·난이도 조건을 반영한 수
  const chapterCounts = useMemo(
    () => countByChapter(filterQuestions(questions, { types: settings.types, difficulties: settings.difficulties })),
    [questions, settings.types, settings.difficulties],
  )
  // 단원 옆 변형 문제 종류 수 — 유형·난이도 조건 반영
  const templateKinds = useMemo(() => {
    const m = new Map<ChapterCode, number>()
    if (!settings.includeTemplates) return m
    const shown = filterTemplates(templates, { ...settings, subjects: [], chapters: [] })
    for (const t of shown) m.set(t.chapter, (m.get(t.chapter) ?? 0) + 1)
    return m
  }, [templates, settings])
  const items = useMemo(() => practiceItems(questions, templates, settings, stats), [questions, templates, settings, stats])
  const candidateCount = items.length
  const variantCount = items.filter((i) => i.kind === 'template').length
  const pickCount = settings.count === 'all' ? candidateCount : Math.min(settings.count, candidateCount)

  const visibleParts = PARTS.filter((p) => settings.subjects.length === 0 || settings.subjects.includes(p.subject))
  const toggleChapter = (code: ChapterCode) =>
    set('chapters', settings.chapters.includes(code) ? settings.chapters.filter((c) => c !== code) : [...settings.chapters, code])
  const setPartChapters = (codes: ChapterCode[], on: boolean) =>
    set('chapters', on ? [...new Set([...settings.chapters, ...codes])] : settings.chapters.filter((c) => !codes.includes(c)))

  return (
    <div className={styles.setup}>
      <Card title="과목">
        <MultiChips
          label="과목"
          options={SUBJECT_OPTIONS}
          selected={settings.subjects}
          onChange={(subjects) => setSettings((s) => withSubjects(s, subjects))}
        />
        <p className={styles.hint}>아무것도 고르지 않으면 전체에서 출제합니다. (아래 항목도 같음)</p>
      </Card>

      <Card
        title="단원"
        actions={
          settings.chapters.length > 0 && (
            <Button variant="ghost" onClick={() => set('chapters', [])}>
              선택 해제 ({settings.chapters.length})
            </Button>
          )
        }
      >
        <div className={styles.parts}>
          {visibleParts.map((part) => {
            const chapters = chaptersOfPart(part.code)
            const codes = chapters.map((c) => c.code as ChapterCode)
            const chosen = codes.filter((c) => settings.chapters.includes(c)).length
            const total = codes.reduce((sum, c) => sum + (chapterCounts.get(c) ?? 0), 0)
            const kinds = codes.reduce((sum, c) => sum + (templateKinds.get(c) ?? 0), 0)
            return (
              <details key={part.code} className={styles.part} open={chosen > 0 || undefined}>
                <summary className={styles.partSummary}>
                  <span>
                    {part.label} · {part.name}
                  </span>
                  <span className={styles.partMeta}>
                    {chosen > 0 ? `${chosen}개 선택 · ` : ''}
                    {total}문제
                    {kinds > 0 && ` · 변형 ${kinds}종`}
                  </span>
                </summary>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={chosen === codes.length}
                    onChange={(e) => setPartChapters(codes, e.target.checked)}
                  />
                  <span>{part.label} 전체</span>
                </label>
                {chapters.map((c) => {
                  const code = c.code as ChapterCode
                  const n = chapterCounts.get(code) ?? 0
                  const k = templateKinds.get(code) ?? 0
                  return (
                    <label key={code} className={`${styles.check} ${n + k === 0 ? styles.empty : ''}`}>
                      <input type="checkbox" checked={settings.chapters.includes(code)} onChange={() => toggleChapter(code)} />
                      <span className={styles.chapterName}>
                        {code} {c.name}
                      </span>
                      <span className={styles.count}>
                        {n}문제{k > 0 && ` · 변형 ${k}종`}
                      </span>
                    </label>
                  )
                })}
              </details>
            )
          })}
        </div>
      </Card>

      <Card title="유형">
        <MultiChips label="유형" options={TYPE_OPTIONS} selected={settings.types} onChange={(v) => set('types', v)} />
      </Card>

      <Card title="난이도">
        <MultiChips
          label="난이도"
          options={DIFFICULTY_OPTIONS}
          selected={settings.difficulties}
          onChange={(v) => set('difficulties', v)}
        />
      </Card>

      <Card title="풀이 방식">
        <SingleChips label="풀이 상태" options={PROGRESS_OPTIONS} value={settings.progress} onChange={(v) => set('progress', v)} />
        <p className={styles.hint}>"틀린 문제만"은 가장 최근에 풀었을 때 틀린 문제입니다.</p>
        <SingleChips label="문항 수" options={COUNT_OPTIONS} value={settings.count} onChange={(v) => set('count', v)} />
        <label className={styles.check}>
          <input type="checkbox" checked={settings.shuffle} onChange={(e) => set('shuffle', e.target.checked)} />
          <span>문제 순서 섞기</span>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={settings.shuffleChoices} onChange={(e) => set('shuffleChoices', e.target.checked)} />
          <span>보기 순서 섞기 (번호를 외우지 않도록)</span>
        </label>
        {templates.length > 0 && (
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.includeTemplates}
              onChange={(e) => set('includeTemplates', e.target.checked)}
            />
            <span>변형 문제 포함 (풀 때마다 데이터가 바뀌는 SQL 문제)</span>
          </label>
        )}
      </Card>

      <div className={styles.startBar}>
        <p className={styles.summary} aria-live="polite">
          {candidateCount === 0 ? (
            '조건에 맞는 문제가 없습니다. 조건을 줄여 보세요.'
          ) : (
            <>
              조건에 맞는 문제 <strong>{candidateCount}</strong>개
              {variantCount > 0 && ` (변형 문제 ${variantCount}개 포함)`} → 이번에 <strong>{pickCount}</strong>문제
            </>
          )}
        </p>
        <Button size="lg" disabled={candidateCount === 0 || preparing} onClick={() => onStart(settings)}>
          {preparing ? '문제를 준비하는 중…' : '연습 시작'}
        </Button>
      </div>
    </div>
  )
}
