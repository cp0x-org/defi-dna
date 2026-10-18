import type {
  Change,
  ExtraIncident,
  ExtraMultisig,
  IndexBundle,
  MetricsFile,
  Protocol,
} from '@defi-dna/data'
import { feeds, protocols } from './registry.ts'
import { toneFromIndex, type Tone } from './status.ts'

/** What DefiLlama records against one version: its own count, and the latest entry. */
export interface Incidents {
  count: number
  latest: ExtraIncident | null
}

/** What the governance metric read from the version's contracts on Ethereum mainnet. */
export interface Governance {
  /** Seconds the executor timelock enforces; null when none of the contracts read is a timelock. */
  delay: number | null
  /** Multisigs among the contracts read, each with the threshold its contract reports. */
  multisigs: ExtraMultisig[]
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
  /** null when DefiLlama's incident list was not collected for this version. */
  incidents: Incidents | null
  /** Moves in a feed's published value, as our run log recorded them; newest first. */
  changes: Change[]
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

export const changedAt = (row: Row): string | null => row.changes[0]?.ts ?? null

/** Every registry entry, in registry order, joined with what was collected about it. */
export function buildRows(index: IndexBundle, sources: RowSources = {}): Row[] {
  const collected = new Map(index.rows.map((row) => [row.id, row]))
  const log = [...(sources.changes ?? [])].sort((a, b) => b.ts.localeCompare(a.ts))
  return protocols.map((protocol) => {
    const generated = collected.get(protocol.id)
    const incidents = sources.metrics?.[protocol.id]?.['incidents']
    const governance = sources.metrics?.[protocol.id]?.['governance']
    const list = [...(incidents?.extra?.incidents ?? [])].sort((a, b) =>
      b.date.localeCompare(a.date),
    )
    return {
      protocol,
      tvl: generated?.tvl ?? null,
      // A version with no contracts mapped is stored as a bare null; only a cell with facts was read.
      governance: governance?.extra?.facts
        ? { delay: governance.value, multisigs: governance.extra.multisigs ?? [] }
        : null,
      feeds: generated?.feeds ?? {},
      tones: Object.fromEntries(
        feeds.map((feed) => [feed.id, generated ? toneFromIndex(generated, feed.id) : 'none']),
      ),
      incidents:
        incidents?.value == null ? null : { count: incidents.value, latest: list[0] ?? null },
      changes: log.filter((change) => change.protocolId === protocol.id),
    }
  })
}

/** Nest versions under their protocol name, keeping the order the rows came in. */
export function groupRows(rows: Row[]): Group[] {
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
  a.multisigs.map((m) => m.address).join() === b.multisigs.map((m) => m.address).join()
