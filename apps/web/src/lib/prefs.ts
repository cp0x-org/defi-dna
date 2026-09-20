/** Small view preferences that survive a reload — stored in a cookie, never sent anywhere. */
const COOKIE = 'defi-dna_hidden_feeds'
const MAX_AGE = 60 * 60 * 24 * 365

/**
 * Feeds the visitor switched off. We store the hidden set, not the visible one,
 * so "everything" stays the default — including feeds added after this visit.
 */
export const readHiddenFeeds = (): string[] => {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`))
    return match?.[1] ? decodeURIComponent(match[1]).split(',').filter(Boolean) : []
  } catch {
    return []
  }
}

export const writeHiddenFeeds = (ids: string[]): void => {
  try {
    document.cookie = `${COOKIE}=${encodeURIComponent(ids.join(','))}; path=${
      import.meta.env.BASE_URL
    }; max-age=${MAX_AGE}; samesite=lax`
  } catch {
    /* cookies unavailable (private mode, file://) — the selection resets next visit */
  }
}
