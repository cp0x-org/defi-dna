import type { Detail, FeedAdapter, FeedResult } from '@defi-dna/core'

/** The per-protocol counts admin-feed publishes on GitHub Pages; rebuilt with every hourly poll. */
const API = 'https://imal1ice.github.io/admin-feed/control/index.json'
/** Counts move only when an event lands or leaves the window: a few reads a day are enough. */
const TTL = 6 * 3600

export interface WatchedContract {
  address: string
  label: string
  type: string
  since: string
  events: number
  last: string | null
}

export interface Entry {
  name: string
  source: string
  system: string
  url: string
  /** Null where ownerwatch cannot decode the system's governance events yet; `note` says why. */
  value: string | null
  note: string | null
  updatedAt: string
  lastEvent: string | null
  window: { days: number; from: string }
  contracts: WatchedContract[]
}

interface IndexFile {
  generated: string
  protocols: Record<string, Entry>
}

const detailsOf = (entry: Entry): Detail[] =>
  entry.contracts.map((contract) => ({
    name: contract.label,
    value: contract.last ? `${contract.events} · last ${contract.last}` : `${contract.events}`,
    description: `${contract.type} ${contract.address}, watched since ${contract.since}`,
  }))

const factsOf = (entry: Entry): Detail[] =>
  (
    [
      { name: 'Governance system', value: entry.name },
      { name: 'Window', value: `${entry.window.days} days from ${entry.window.from}` },
      { name: 'Last counted event', value: entry.lastEvent },
      { name: 'Contract addresses from', value: entry.source },
    ] as { name: string; value: string | null }[]
  ).flatMap(({ name, value }) => (value ? [{ name, value }] : []))

/**
 * ownerwatch — admin events on each protocol's governance contracts, counted.
 *
 * admin-feed watches the governance contracts of each protocol on Ethereum
 * mainnet with ownerwatch and publishes, per protocol, two counts over a
 * rolling 90-day window: control changes (owners, roles, upgrades, delays,
 * Safe signers) and executed governance actions, once per transaction. Where
 * governance runs through Safes it publishes control changes only; where
 * ownerwatch cannot decode a system's events yet it publishes a note and no
 * value. The counts carry no reading of their own, so the feed declares no
 * `status`. Its ids are ours: the JSON is keyed by this registry's protocol ids.
 *
 * One read per run.
 */
const adapter: FeedAdapter<Record<string, Entry>> = {
  id: 'ownerwatch',

  async prepare(ctx) {
    const index = await ctx.getJson<IndexFile>(API, { ttlSeconds: TTL })
    ctx.log(`${Object.keys(index.protocols).length} protocols, generated ${index.generated}`)
    return index.protocols
  },

  async collect({ protocol, ctx, prepared }): Promise<FeedResult | null> {
    const [id] = ctx.mapping[protocol.id] ?? []
    if (!id) return null

    const entry = prepared[id]
    if (!entry) return { note: `ownerwatch lists nothing for ${protocol.name}.` }
    if (!entry.value) return { url: entry.url, note: entry.note ?? undefined }

    return {
      value: entry.value,
      updatedAt: entry.updatedAt,
      url: entry.url,
      details: detailsOf(entry),
      ...(entry.note ? { note: entry.note } : {}),
      extra: { facts: factsOf(entry) },
    }
  },
}

export default adapter
