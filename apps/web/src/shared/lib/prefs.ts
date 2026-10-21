/**
 * Small view preferences that survive a reload, kept in localStorage like the
 * theme. A cookie on this path is sent with same-origin data requests, and a
 * preference never needs to leave the browser. A value left in the old cookie
 * of the same preference is copied across once and then dropped.
 */

const cookieValue = (name: string): string | undefined =>
  document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1]

const forgetCookie = (name: string): void => {
  document.cookie = `${name}=; path=${import.meta.env.BASE_URL}; max-age=0; samesite=lax`
}

/** The stored value, or the old cookie's moved into storage; null when there is neither. */
const read = (key: string, cookie: string): string | null => {
  try {
    const stored = localStorage.getItem(key)
    if (stored != null) return stored
    const previous = cookieValue(cookie)
    if (previous != null) {
      const value = decodeURIComponent(previous)
      localStorage.setItem(key, value)
      forgetCookie(cookie)
      return value
    }
  } catch {
    /* Storage can be blocked; the choice then resets on the next visit. */
  }
  return null
}

const write = (key: string, cookie: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
    forgetCookie(cookie)
  } catch {
    /* Storage can be blocked; the choice then resets on the next visit. */
  }
}

/** How the dashboard draws coverage: a ring, a bar of segments, or both side by side. */
export type CoverageView = 'ring' | 'bar' | 'both'

const VIEW_KEY = 'defi-dna-coverage-view'
const VIEW_COOKIE = 'defi-dna_coverage_view'

const isView = (value: string | null): value is CoverageView =>
  value === 'ring' || value === 'bar' || value === 'both'

export const readCoverageView = (): CoverageView => {
  const value = read(VIEW_KEY, VIEW_COOKIE)
  return isView(value) ? value : 'ring'
}

export const writeCoverageView = (view: CoverageView): void => write(VIEW_KEY, VIEW_COOKIE, view)

/** The dashboard columns a visitor can hide, in table order; the protocol column always shows. */
export const COLUMNS = {
  category: 'Category',
  tvl: 'TVL',
  timelock: 'Governance timelock',
  governance: 'Governance',
  coverage: 'Coverage',
  signals: 'Signals',
  incidents: 'Incidents',
  updated: 'Updated',
} as const
export type ColumnKey = keyof typeof COLUMNS

const COLUMNS_KEY = 'defi-dna-hidden-columns'
const COLUMNS_COOKIE = 'defi-dna_hidden_columns'

const isColumn = (key: string): key is ColumnKey => Object.hasOwn(COLUMNS, key)

/** What is stored is the hidden set, so a column added later shows for everyone. */
export const readHiddenColumns = (): Set<ColumnKey> =>
  new Set((read(COLUMNS_KEY, COLUMNS_COOKIE) ?? '').split(',').filter(isColumn))

export const writeHiddenColumns = (hidden: Set<ColumnKey>): void =>
  write(COLUMNS_KEY, COLUMNS_COOKIE, [...hidden].join(','))
