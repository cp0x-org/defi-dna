import type { AssessedObject, FeedData } from '@defi-dna/data'

export { formatDuration, formatUsd } from '@defi-dna/data'

/** Categories come from the registry as plain strings; this only prettifies them. */
const CATEGORY_LABELS: Record<string, string> = {
  lending: 'Lending',
  dex: 'DEX / AMM',
  aggregator: 'Swap aggregator',
  yield: 'Yield / vault',
  'liquid-staking': 'Liquid staking',
}

export const categoryLabel = (category: string): string => CATEGORY_LABELS[category] ?? category

/**
 * What a feed's values are about, in words. Printed next to every value so a
 * vault tier is never read as a statement about the protocol.
 */
const ASSESSES_LABELS: Record<AssessedObject, string> = {
  protocol: 'the protocol',
  deployment: 'each deployment separately',
  vault: 'individual vaults, not the protocol',
  'vault-protocol': 'individual vaults and the protocol',
  pool: 'individual pools, not the protocol',
  asset: 'individual assets, not the protocol',
  research: 'in published research, without a rating scale',
}

export const assessesLabel = (assesses: AssessedObject): string => ASSESSES_LABELS[assesses]

/** The three states a cell can be in. None of them is a safety judgement. */
export const coverageLabel = (status: FeedData['status']): string =>
  status === 'ok' ? 'Data available' : status === 'error' ? 'Collection error' : 'No data'

/** Stable colour slot for a feed mark, so a new feed needs no CSS. */
export const sourceTone = (id: string): number =>
  [...id].reduce((total, char) => total + char.charCodeAt(0), 0) % 5

export const safeUrl = (value?: string | null): string | undefined => {
  try {
    const url = new URL(value ?? '')
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}

/**
 * A date, rendered for a reader.
 *
 * `older` marks anything past 90 days: a prompt to check the source, never a
 * claim that the assessment expired.
 */
export const dateInfo = (value?: string | null, now = Date.now()) => {
  const unknown = { label: 'Date unavailable', age: null as number | null, older: false }
  if (!value || !/^\d{4}-\d{2}(?:-\d{2})?(?:T.*)?$/.test(value) || value.startsWith('1970-')) {
    return unknown
  }
  const date = new Date(value.length === 7 ? `${value}-01T00:00:00Z` : value)
  if (!Number.isFinite(date.getTime()) || date.getTime() > now + 86400000) return unknown
  const age = Math.max(0, Math.floor((now - date.getTime()) / 86400000))
  const label = date.toLocaleDateString('en-GB', {
    ...(value.length === 7 ? {} : { day: 'numeric' }),
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return { label, age, older: age > 90 }
}

/** How long ago, in the units a reader scans fastest: `40m`, `5h`, `12d`. */
export const ageLabel = (value?: string | null, now = Date.now()): string | null => {
  const time = value ? Date.parse(value) : NaN
  if (!Number.isFinite(time)) return null
  const minutes = Math.max(0, Math.floor((now - time) / 60000))
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
  return `${Math.floor(minutes / 1440)}d`
}

/** A timestamp with its UTC time, for when the minute matters: `11 Oct 2026 · 13:36 UTC`. */
export const timeLabel = (value?: string | null): string | null => {
  const date = new Date(value ?? '')
  if (!value || !Number.isFinite(date.getTime())) return null
  const day = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${day} · ${date.toISOString().slice(11, 16)} UTC`
}
