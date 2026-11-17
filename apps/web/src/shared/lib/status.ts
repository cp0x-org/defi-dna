import {
  readStatus,
  readValue,
  statusWord,
  type Feed,
  type FeedData,
  type IndexRow,
  type Reading,
} from '@defi-dna/data'

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
export const ruleWord = (feed: Feed, value?: string): string | null =>
  statusWord(feed.status, value)

export const toneOf = (feed: Feed, data?: FeedData): Tone => {
  if (!data || data.status === 'none') return 'none'
  if (data.status === 'error') return 'error'
  const reading = readStatus(feed, data)
  return reading ? FROM_READING[reading] : 'inf'
}

/** One entry of a feed's breakdown, read with its `detailStatus`; null where the rule says nothing. */
export const detailToneOf = (feed: Feed, value: string): Tone | null => {
  const reading = readValue(feed.detailStatus, value)
  return reading ? FROM_READING[reading] : null
}

/** A dashboard row: the bundle copied each feed's own reading into the index. */
export const toneFromIndex = (row: Pick<IndexRow, 'feeds' | 'readings'>, feedId: string): Tone => {
  if (!row.feeds[feedId]) return 'none'
  const reading = row.readings?.[feedId]
  return reading ? FROM_READING[reading] : 'inf'
}

export type Signal = 'neg' | 'neu' | 'pos'

export const SIGNAL_LABELS: Record<Signal, string> = {
  neg: 'Negative',
  neu: 'Neutral / informational',
  pos: 'Positive',
}

/** Legends read from positive to negative. */
export const LEGEND_SIGNALS: Signal[] = ['pos', 'neu', 'neg']

/** The colour a signal group is drawn in. `neu` also holds `inf`, which shares its colour. */
export const SIGNAL_TONES: Record<Signal, Tone> = { neg: 'neg', neu: 'neu', pos: 'pos' }
