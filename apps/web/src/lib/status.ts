import type { Feed, FeedData, Reading } from '@defi-dna/data'

/**
 * What a segment, dot or pill says about one feed's cell.
 *
 * `pos`, `neu`, `neg` — the feed's own characterization, read with the rule
 * its feed.json declares. `inf` — the feed has data but its own scale gives no
 * reading of this value: it gets the neutral colour, never a guess of ours.
 * `none` — no data, grey. `error` — we could not read the feed.
 */
export type Tone = 'pos' | 'neu' | 'inf' | 'neg' | 'none' | 'error'

export const TONE_LABELS: Record<Tone, string> = {
  pos: 'Positive',
  neu: 'Neutral',
  inf: 'Data available',
  neg: 'Negative',
  none: 'No data',
  error: 'Collection error',
}

const FROM_READING: Record<Reading, Tone> = { positive: 'pos', neutral: 'neu', negative: 'neg' }

/** The feed's own word or band in a headline, when its rule finds one there. */
export const statusWord = (feed: Feed, value?: string): string | null => {
  if (!feed.status || !value) return null
  try {
    return new RegExp(feed.status.match, 'i').exec(value)?.[1]?.toLowerCase() ?? null
  } catch {
    return null
  }
}

export function toneOf(feed: Feed, data?: FeedData): Tone {
  if (!data || data.status === 'none') return 'none'
  if (data.status === 'error') return 'error'
  const word = statusWord(feed, data.value)
  const values = feed.status?.values
  return word && values && Object.hasOwn(values, word) ? FROM_READING[values[word]!] : 'inf'
}

/** Before a record is loaded the index only says whether data exists: neutral or grey. */
export const toneFromFlag = (has: boolean | undefined): Tone => (has ? 'inf' : 'none')

export type Signal = 'neg' | 'neu' | 'pos'

export const SIGNAL_LABELS: Record<Signal, string> = {
  neg: 'Negative',
  neu: 'Neutral / informational',
  pos: 'Positive',
}

/** Which signal group a tone falls in; neutral and data-without-a-reading share one. */
export const signalOf = (tone: Tone): Signal | null =>
  tone === 'neg' ? 'neg' : tone === 'pos' ? 'pos' : tone === 'neu' || tone === 'inf' ? 'neu' : null

/**
 * How many feeds sit in each group, each count kept apart.
 *
 * Preview: this is a number computed from several feeds' values, which
 * CHARTER §1 rules out without the Ethereum Foundation's written agreement.
 * It must not ship until that agreement is recorded in the charter.
 */
export const signalCounts = (tones: Tone[]): Record<Signal, number> => {
  const counts = { neg: 0, neu: 0, pos: 0 }
  for (const tone of tones) {
    const signal = signalOf(tone)
    if (signal) counts[signal] += 1
  }
  return counts
}
