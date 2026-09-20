import type { FeedData } from '@defi-dna/data'

export { formatUsd } from '@defi-dna/data'

/** Categories come from the registry as plain strings; this only prettifies them. */
const CATEGORY_LABELS: Record<string, string> = {
  lending: 'Lending',
  dex: 'DEX / AMM',
  aggregator: 'Swap aggregator',
  yield: 'Yield / vault',
  'liquid-staking': 'Liquid staking',
}

export const categoryLabel = (category: string): string => CATEGORY_LABELS[category] ?? category

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

export const TVL_BANDS: Record<string, { label: string; min: number; max: number }> = {
  '1b': { label: '$1B and above', min: 1e9, max: Infinity },
  '100m': { label: '$100M – $1B', min: 1e8, max: 1e9 },
  '10m': { label: '$10M – $100M', min: 1e7, max: 1e8 },
  sub10m: { label: 'Under $10M', min: 0, max: 1e7 },
}
