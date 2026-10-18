/** Small view preferences that survive a reload — stored in cookies, never sent anywhere. */
const MAX_AGE = 60 * 60 * 24 * 365

const readCookie = (name: string): string | null => {
  try {
    const value = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1]
    return value == null ? null : decodeURIComponent(value)
  } catch {
    return null
  }
}

const writeCookie = (name: string, value: string): void => {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=${import.meta.env.BASE_URL}; max-age=${MAX_AGE}; samesite=lax`
  } catch {
    /* cookies unavailable (private mode, file://) — the choice resets next visit */
  }
}

/** How the dashboard draws coverage: a ring, a bar of segments, or both side by side. */
export type CoverageView = 'ring' | 'bar' | 'both'

export const readCoverageView = (): CoverageView => {
  const value = readCookie('defi-dna_coverage_view')
  return value === 'bar' || value === 'both' ? value : 'ring'
}

export const writeCoverageView = (view: CoverageView): void =>
  writeCookie('defi-dna_coverage_view', view)

/** The dashboard columns a visitor can hide, in table order; the protocol column always shows. */
export const COLUMNS = {
  category: 'Category',
  tvl: 'TVL',
  timelock: 'Governance timelock',
  multisigs: 'Multisigs',
  coverage: 'Coverage',
  signals: 'Signals',
  incidents: 'Incidents',
  updated: 'Updated',
} as const
export type ColumnKey = keyof typeof COLUMNS

const isColumn = (key: string): key is ColumnKey => Object.hasOwn(COLUMNS, key)

/** What is stored is the hidden set, so a column added later shows for everyone. */
export const readHiddenColumns = (): Set<ColumnKey> =>
  new Set((readCookie('defi-dna_hidden_columns') ?? '').split(',').filter(isColumn))

export const writeHiddenColumns = (hidden: Set<ColumnKey>): void =>
  writeCookie('defi-dna_hidden_columns', [...hidden].join(','))
