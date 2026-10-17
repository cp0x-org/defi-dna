import type { ReactNode } from 'react'
import { TONE_LABELS, type Tone } from '../lib/status.ts'

/*
 * The colour vocabulary of these pages. A colour other than neutral or grey is
 * the feed's own characterization, read from its own published scale (see
 * lib/status.ts) — never a judgement of ours.
 */

/** Where a piece of information comes from — the four kinds on every page. */
const PROV_LABELS = { meta: 'Meta', cov: 'Coverage', src: 'Source', cp: 'CP0X' } as const

export const Prov = ({
  kind,
  children,
  title,
}: {
  kind: keyof typeof PROV_LABELS
  children?: ReactNode
  title?: string
}) => (
  <span className={`prov ${kind}`} title={title}>
    {children ?? PROV_LABELS[kind]}
  </span>
)

export const StatusDot = ({ tone }: { tone: Tone }) => (
  <i className={`dot st-${tone}`} aria-hidden="true" />
)

export const StatusPill = ({ tone, dot = false }: { tone: Tone; dot?: boolean }) => (
  <span className={`pill st-${tone}`}>
    {dot ? <StatusDot tone={tone} /> : null}
    {TONE_LABELS[tone]}
  </span>
)

/**
 * One arc per feed, in registry order, clockwise from 12 o'clock. The arcs are
 * all the same length on purpose: a feed counts once, whatever it publishes.
 */
export const CoverageRing = ({
  states,
  size = 30,
  label,
}: {
  states: Tone[]
  size?: number
  label?: string
}) => {
  const centre = size / 2
  const radius = size / 2 - 3
  const gap = states.length > 1 ? 0.16 : 0
  const point = (angle: number) =>
    `${(centre + radius * Math.cos(angle)).toFixed(2)} ${(centre + radius * Math.sin(angle)).toFixed(2)}`
  return (
    <svg
      className="ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      {states.length === 1 ? (
        <circle className={`st-${states[0]}`} cx={centre} cy={centre} r={radius} />
      ) : (
        states.map((status, k) => {
          const from = -Math.PI / 2 + (k * 2 * Math.PI) / states.length + gap / 2
          const to = -Math.PI / 2 + ((k + 1) * 2 * Math.PI) / states.length - gap / 2
          return (
            <path
              key={k}
              className={`st-${status}`}
              d={`M${point(from)} A${radius} ${radius} 0 0 1 ${point(to)}`}
            />
          )
        })
      )}
      {label ? (
        <text x={centre} y={centre + 3.5} textAnchor="middle">
          {label}
        </text>
      ) : null}
    </svg>
  )
}

export const CoverageBar = ({ states }: { states: Tone[] }) => (
  <span className="sbar" aria-hidden="true">
    {states.map((status, k) => (
      <i key={k} className={`st-${status}`} />
    ))}
  </span>
)
