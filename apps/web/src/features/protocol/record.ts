import type { Change, ExtraIncident, Feed, ProtocolDetail } from '@defi-dna/data'
import { INCIDENTS_METRIC, feeds } from '../../shared/lib/registry.ts'
import { incidentsByDate } from '../dashboard/rows.ts'
import { toneOf, type Tone } from '../../shared/lib/status.ts'

/**
 * What the protocol page reads off one collected record, computed once and
 * shared by the page and its tabs. `tones` follows the registry order of feeds.
 */
export interface RecordSummary {
  tones: Tone[]
  /** Feeds that published something about this version. */
  withData: Feed[]
  /** Feeds we failed to read for this version. */
  errors: Feed[]
  /** DefiLlama's newest entry, when its list was collected. */
  latestIncident: ExtraIncident | undefined
}

/** Consecutive moves of one feed's value in a newest-first log, read as one line. */
export interface ChangeRun {
  feedId: string
  /** Newest first, as the log lists them; never fewer than one. */
  entries: Change[]
}

/**
 * Fold a feed's back-to-back moves into one run. Nothing is dropped: a run
 * keeps every entry, the page shows the span and the latest value and opens
 * the rest on request. A move by another feed in between starts a new run.
 */
export const runsOf = (changes: Change[]): ChangeRun[] => {
  const runs: ChangeRun[] = []
  for (const change of changes) {
    const last = runs.at(-1)
    if (last?.feedId === change.feedId && last.entries[0]?.protocolId === change.protocolId) {
      last.entries.push(change)
    } else {
      runs.push({ feedId: change.feedId, entries: [change] })
    }
  }
  return runs
}

export const summarizeRecord = (record: ProtocolDetail): RecordSummary => ({
  tones: feeds.map((feed) => toneOf(feed, record.feeds[feed.id])),
  withData: feeds.filter((feed) => record.feeds[feed.id]?.status === 'ok'),
  errors: feeds.filter((feed) => record.feeds[feed.id]?.status === 'error'),
  latestIncident: incidentsByDate(record.metrics?.[INCIDENTS_METRIC])[0],
})
