/**
 * How the dashboard draws coverage, kept in localStorage like the theme.
 * A cookie on this path is sent with same-origin data requests, and the
 * preference never needs to leave the browser. A value left in the old cookie
 * is copied across once and then dropped.
 */
const KEY = 'defi-dna-coverage-view'
const COOKIE = 'defi-dna_coverage_view'

/** How the dashboard draws coverage: a ring, a bar of segments, or both side by side. */
export type CoverageView = 'ring' | 'bar' | 'both'

const isView = (value: string | null | undefined): value is CoverageView =>
  value === 'ring' || value === 'bar' || value === 'both'

const cookieView = (): string | undefined =>
  document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`))?.[1]

const forgetCookie = (): void => {
  document.cookie = `${COOKIE}=; path=${import.meta.env.BASE_URL}; max-age=0; samesite=lax`
}

export const readCoverageView = (): CoverageView => {
  try {
    const stored = localStorage.getItem(KEY)
    if (isView(stored)) return stored
    const previous = cookieView()
    if (isView(previous)) {
      localStorage.setItem(KEY, previous)
      forgetCookie()
      return previous
    }
  } catch {
    /* Storage can be blocked; the choice then resets on the next visit. */
  }
  return 'ring'
}

export const writeCoverageView = (view: CoverageView): void => {
  try {
    localStorage.setItem(KEY, view)
    forgetCookie()
  } catch {
    /* Storage can be blocked; the choice then resets on the next visit. */
  }
}
