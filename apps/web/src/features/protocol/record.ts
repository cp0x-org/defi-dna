import type { ExtraIncident, Feed, ProtocolDetail } from '@defi-dna/data'
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

export const summarizeRecord = (record: ProtocolDetail): RecordSummary => ({
  tones: feeds.map((feed) => toneOf(feed, record.feeds[feed.id])),
  withData: feeds.filter((feed) => record.feeds[feed.id]?.status === 'ok'),
  errors: feeds.filter((feed) => record.feeds[feed.id]?.status === 'error'),
  latestIncident: incidentsByDate(record.metrics?.[INCIDENTS_METRIC])[0],
})
