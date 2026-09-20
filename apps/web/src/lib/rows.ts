import type { IndexBundle, Protocol } from '@defi-dna/data'
import { feeds, protocols } from './registry.ts'

/** One protocol version: the hand-maintained entry joined with what we collected. */
export interface Row {
  protocol: Protocol
  tvl: number | null
  /** feed id -> that feed has data for this version */
  feeds: Record<string, boolean>
}

/**
 * Versions of one protocol, nested for reading.
 *
 * Grouping is presentation only. Each version keeps its own collected row, and
 * the group's figures are arithmetic on facts: TVL is a sum, and a group flag
 * means "at least one of these versions has data from that feed".
 */
export interface Group {
  key: string
  name: string
  rows: Row[]
  tvl: number | null
  feeds: Record<string, boolean>
}

export const dataCount = (flags: Record<string, boolean>, feedIds: string[]): number =>
  feedIds.filter((id) => flags[id]).length

/** Join the generated coverage onto the protocol registry, then nest by group. */
export function groupRows(index: IndexBundle, keep: (row: Row) => boolean): Group[] {
  const collected = new Map(index.rows.map((row) => [row.id, row]))
  const groups = new Map<string, Group>()

  for (const protocol of protocols) {
    const generated = collected.get(protocol.id)
    const row: Row = {
      protocol,
      tvl: generated?.tvl ?? null,
      feeds: generated?.feeds ?? {},
    }
    if (!keep(row)) continue

    const key = protocol.group ?? protocol.id
    const group = groups.get(key) ?? {
      key,
      name: protocol.group ?? protocol.name,
      rows: [],
      tvl: null,
      feeds: {},
    }
    group.rows.push(row)
    if (row.tvl != null) group.tvl = (group.tvl ?? 0) + row.tvl
    for (const feed of feeds) {
      if (row.feeds[feed.id]) group.feeds[feed.id] = true
    }
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    group.rows.sort((a, b) => (b.tvl ?? -1) - (a.tvl ?? -1))
  }
  return [...groups.values()]
}
