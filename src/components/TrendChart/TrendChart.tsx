import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { DataTable } from '../DataTable/DataTable'
import styles from './TrendChart.module.css'

export interface TrendPoint {
  /** 가로축 짧은 이름 (예: "11/3") */
  label: string
  /** 0~100 */
  value: number
  /** 툴팁·표에 보여 줄 자세한 글 (예: "74/100점 · 합격") */
  detail: string
}

interface Props {
  points: readonly TrendPoint[]
  /** 기준선 (예: 합격선 60) */
  threshold?: { value: number; label: string }
  /** 스크린리더용 요약 */
  summary: string
}

// SVG 좌표계 (화면 폭에 맞춰 늘어난다)
const W = 600
const H = 220
const PAD = { top: 16, right: 20, bottom: 28, left: 40 }
const TICKS = [0, 20, 40, 60, 80, 100]

/**
 * 추이 선 그래프 (T6-5) — 라이브러리 없이 SVG
 * - 선 2px, 점 지름 8px + 배경색 테두리, 눈금선 1px (dataviz 지침)
 * - 한 계열이라 범례 없음 (카드 제목이 무엇을 그렸는지 말한다)
 * - 마우스·터치를 올리면 가장 가까운 회차에 세로선 + 툴팁, 키보드(←/→)로도 이동
 * - "표로 보기"로 같은 값을 표로 볼 수 있다
 */
export function TrendChart({ points, threshold, summary }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const tableId = useId()

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const xOf = (i: number) => PAD.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const yOf = (v: number) => PAD.top + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH

  const path = useMemo(
    () => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' '),
    [points],
  )

  // 가로축 이름: 많으면 처음·끝·가운데 정도만
  const showLabel = (i: number) => points.length <= 6 || i === 0 || i === points.length - 1 || i === Math.floor((points.length - 1) / 2)

  /** 포인터 위치 → 가장 가까운 회차 */
  function onPointerMove(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    points.forEach((_, i) => {
      if (Math.abs(xOf(i) - x) < Math.abs(xOf(best) - x)) best = i
    })
    setActive(best)
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (points.length === 0) return
    if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1))
    else if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1))
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  const a = active !== null ? points[active] : undefined

  return (
    <div className={styles.wrap}>
      <div className={styles.chart}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.svg}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((x) => x ?? points.length - 1)}
          onBlur={() => setActive(null)}
        >
          {/* 눈금선·세로축 숫자 */}
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yOf(t)} y2={yOf(t)} className={styles.grid} />
              <text x={PAD.left - 8} y={yOf(t)} className={styles.axisY}>
                {t}
              </text>
            </g>
          ))}

          {/* 기준선 (합격선) */}
          {threshold && (
            <g>
              <line x1={PAD.left} x2={W - PAD.right} y1={yOf(threshold.value)} y2={yOf(threshold.value)} className={styles.threshold} />
              <text x={W - PAD.right} y={yOf(threshold.value) - 6} className={styles.thresholdLabel}>
                {threshold.label}
              </text>
            </g>
          )}

          {/* 가로축 이름 */}
          {points.map((p, i) =>
            showLabel(i) ? (
              <text key={i} x={xOf(i)} y={H - 8} className={styles.axisX}>
                {p.label}
              </text>
            ) : null,
          )}

          {/* 십자선 */}
          {a && active !== null && <line x1={xOf(active)} x2={xOf(active)} y1={PAD.top} y2={PAD.top + plotH} className={styles.crosshair} />}

          {/* 선과 점 */}
          {points.length > 1 && <path d={path} className={styles.line} />}
          {points.map((p, i) => (
            <circle key={i} cx={xOf(i)} cy={yOf(p.value)} r={i === active ? 6 : 4} className={styles.dot} data-testid="trend-dot" />
          ))}

          {/* 포인터 영역 — 점보다 넓게 */}
          <rect
            x={PAD.left - 10}
            y={0}
            width={plotW + 20}
            height={H}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerDown={onPointerMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

        {a && active !== null && (
          <div
            className={styles.tooltip}
            role="status"
            style={{
              left: `${(xOf(active) / W) * 100}%`,
              top: `${(yOf(a.value) / H) * 100}%`,
            }}
          >
            <strong>{a.label}</strong> {a.value}%<br />
            {a.detail}
          </div>
        )}
      </div>

      <details className={styles.tableView}>
        <summary aria-controls={tableId}>표로 보기</summary>
        <div id={tableId}>
          <DataTable columns={['회차', '날짜', '백분율', '내용']} rows={points.map((p, i) => [i + 1, p.label, `${p.value}%`, p.detail])} />
        </div>
      </details>
    </div>
  )
}
