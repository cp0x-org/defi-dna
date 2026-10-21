import type {
  Change,
  ExtraIncident,
  ExtraGovernanceBody,
  IndexBundle,
  MetricData,
  MetricsFile,
  Protocol,
} from '@defi-dna/data'
import { GOVERNANCE_METRIC, INCIDENTS_METRIC, feeds, protocols } from '../../shared/lib/registry.ts'
import { toneFromIndex, type Tone } from '../../shared/lib/status.ts'
import { DAY } from '../../shared/lib/view.ts'

/** What DefiLlama records against one version: its own count, and the latest entry. */
export interface Incidents {
  count: number
  latest: ExtraIncident | null
}

/** What the governance metric read from the version's contracts on Ethereum mainnet. */
export interface Governance {
  /** Seconds the executor timelock enforces; null when none of the contracts read is a timelock. */
  delay: number | null
  /** Who decides, as the contracts read report it: token votes, multisigs, single keys. */
  bodies: ExtraGovernanceBody[]
}

/** One protocol version: the hand-maintained entry joined with what we collected. */
export interface Row {
  protocol: Protocol
  tvl: number | null
  /** null when nothing was read on-chain for this version (no contracts mapped, or the read failed). */
  governance: Governance | null
  /** feed id -> that feed has data for this version */
  feeds: Record<string, boolean>
  /** feed id -> the feed's own reading of its value, as the bundle copied it; neutral when none. */
  tones: Record<string, Tone>
  /** null when DefiLlama's incident list was not collected for this version, or not loaded. */
  incidents: Incidents | null
  /**
   * Moves in a feed's published value, as our run log recorded them; newest first.
   * null while the log is loading or when it could not be read — not "no change".
   */
  changes: Change[] | null
}

/**
 * Versions of one protocol, nested for reading.
 *
 * Grouping is presentation only. Each version keeps its own collected row, and
 * the group's figures are arithmetic on facts: TVL and incident counts are sums,
 * and a group flag means "at least one of these versions has data from that feed".
 */
export interface Group {
  key: string
  name: string
  rows: Row[]
  tvl: number | null
  incidents: number | null
  /** The reading every version shares; null when versions differ or one has none. */
  governance: Governance | null
  feeds: Record<string, boolean>
  /** The newest change across the versions, or null when the log has none. */
  changedAt: string | null
}

/** Read beside the index. Either may still be loading, or have failed: rows then carry no such facts. */
export interface RowSources {
  metrics?: MetricsFile | null
  changes?: Change[] | null
}

export const dataCount = (flags: Record<string, boolean>, feedIds: string[]): number =>
  feedIds.filter((id) => flags[id]).length

/** How many of these versions one feed has data for: a count of our collection, not of risk. */
export const coverageCount = (rows: { feeds: Record<string, boolean> }[], feedId: string): number =>
  rows.filter((row) => row.feeds[feedId]).length

/** DefiLlama's entries for one version, newest first. */
export const incidentsByDate = (metric?: MetricData): ExtraIncident[] =>
  [...(metric?.extra?.incidents ?? [])].sort((a, b) => b.date.localeCompare(a.date))

/**
 * One protocol's entries in the run log, newest first. "Changed" everywhere
 * means the newest of these: a move in a feed's published value.
 */
export const changesFor = (log: Change[], protocolId: string): Change[] =>
  log.filter((change) => change.protocolId === protocolId).sort((a, b) => b.ts.localeCompare(a.ts))

export const changedAt = (row: Row): string | null => row.changes?.[0]?.ts ?? null

/** Moves in a feed's value during the last 24 hours. An unreadable log counts as none here. */
export const changedWithinDay = (row: Row, now: number): Change[] =>
  (row.changes ?? []).filter((change) => now - Date.parse(change.ts) <= DAY)

/** Every registry entry, in registry order, joined with what was collected about it. */
export const buildRows = (index: IndexBundle, sources: RowSources = {}): Row[] => {
  const collected = new Map(index.rows.map((row) => [row.id, row]))
  const log = sources.changes
  return protocols.map((protocol) => {
    const generated = collected.get(protocol.id)
    const incidents = sources.metrics?.[protocol.id]?.[INCIDENTS_METRIC]
    const governance = sources.metrics?.[protocol.id]?.[GOVERNANCE_METRIC]
    const list = incidentsByDate(incidents)
    return {
      protocol,
      tvl: generated?.tvl ?? null,
      // A version with no contracts mapped is stored as a bare null; only a cell with facts was read.
      governance: governance?.extra?.facts
        ? { delay: governance.value, bodies: governance.extra.bodies ?? [] }
        : null,
      feeds: generated?.feeds ?? {},
      tones: Object.fromEntries(
        feeds.map((feed) => [feed.id, generated ? toneFromIndex(generated, feed.id) : 'none']),
      ),
      incidents:
        incidents?.value == null ? null : { count: incidents.value, latest: list[0] ?? null },
      changes: log ? changesFor(log, protocol.id) : null,
    }
  })
}

/** Nest versions under their protocol name, keeping the order the rows came in. */
export const groupRows = (rows: Row[]): Group[] => {
  const groups = new Map<string, Group>()
  for (const row of rows) {
    const { protocol } = row
    const key = protocol.group ?? protocol.id
    const group = groups.get(key) ?? {
      key,
      name: protocol.group ?? protocol.name,
      rows: [],
      tvl: null,
      incidents: null,
      governance: null,
      feeds: {},
      changedAt: null,
    }
    group.rows.push(row)
    if (row.tvl != null) group.tvl = (group.tvl ?? 0) + row.tvl
    if (row.incidents) group.incidents = (group.incidents ?? 0) + row.incidents.count
    for (const feed of feeds) {
      if (row.feeds[feed.id]) group.feeds[feed.id] = true
    }
    const changed = changedAt(row)
    if (changed && (!group.changedAt || changed > group.changedAt)) group.changedAt = changed
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    group.rows.sort((a, b) => (b.tvl ?? -1) - (a.tvl ?? -1))
    // Versions usually share one governance; the group row repeats it only when they all do.
    const first = group.rows[0]?.governance ?? null
    group.governance =
      first && group.rows.every((row) => sameGovernance(row.governance, first)) ? first : null
  }
  return [...groups.values()]
}

const sameGovernance = (a: Governance | null, b: Governance): boolean =>
  a != null &&
  a.delay === b.delay &&
  a.bodies.map((body) => body.address).join() === b.bodies.map((body) => body.address).join()
