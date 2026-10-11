import type { ReactNode } from 'react'
import type { FeedData } from '@defi-dna/data'
import { coverageLabel } from '../lib/view.ts'

/**
 * The whole colour vocabulary of coverage: a feed has data we could collect,
 * has none, or we failed to read it. None of the three says anything about
 * what the feed concluded, and nothing else on these pages gets a status colour.
 */
export type Status = FeedData['status']

export const statusOf = (has: boolean | undefined): Status => (has ? 'ok' : 'none')

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

export const StatusDot = ({ status }: { status: Status }) => (
  <i className={`dot st-${status}`} aria-hidden="true" />
)

export const StatusPill = ({ status, dot = false }: { status: Status; dot?: boolean }) => (
  <span className={`pill st-${status}`}>
    {dot ? <StatusDot status={status} /> : null}
    {coverageLabel(status)}
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
  states: Status[]
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

export const CoverageBar = ({ states }: { states: Status[] }) => (
  <span className="sbar" aria-hidden="true">
    {states.map((status, k) => (
      <i key={k} className={`st-${status}`} />
    ))}
  </span>
)
