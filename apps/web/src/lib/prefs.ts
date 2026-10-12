/** Small view preferences that survive a reload — stored in a cookie, never sent anywhere. */
const COOKIE = 'defi-dna_coverage_view'
const MAX_AGE = 60 * 60 * 24 * 365

/** How the dashboard draws coverage: a ring, a bar of segments, or both side by side. */
export type CoverageView = 'ring' | 'bar' | 'both'

export const readCoverageView = (): CoverageView => {
  try {
    const value = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`))?.[1]
    return value === 'bar' || value === 'both' ? value : 'ring'
  } catch {
    return 'ring'
  }
}

export const writeCoverageView = (view: CoverageView): void => {
  try {
    document.cookie = `${COOKIE}=${view}; path=${import.meta.env.BASE_URL}; max-age=${MAX_AGE}; samesite=lax`
  } catch {
    /* cookies unavailable (private mode, file://) — the choice resets next visit */
  }
}
