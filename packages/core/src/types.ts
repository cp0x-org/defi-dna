/**
 * Every shape the pipeline and the frontend share.
 *
 * The rule behind all of them: we store what a feed published, plus where and
 * when we read it. Feeds measure different things — one grades a protocol,
 * another grades the vaults inside it — so nothing here converts one feed's
 * value into another's, and nothing computes a score of our own.
 */

/**
 * A protocol version we track. One row on the dashboard.
 *
 * Versions are separate protocols: sources file Aave v3 and v4 separately, so
 * we collect them separately. `group` only nests the rows for reading — no
 * value is ever carried from one version to another.
 */
export interface Protocol {
  id: string
  name: string
  /** Display grouping: "Aave", "Uniswap". Rows without one stand alone. */
  group?: string
  /** Free label, shown as published: "lending", "dex", "yield", ... */
  category: string
  website?: string
  description?: string
}

/**
 * A risk feed: one column on the dashboard.
 *
 * Hand-maintained in adapters/feeds/<id>/feed.json, next to the adapter that
 * reads it, and imported by the frontend at build time.
 */
export interface Feed {
  id: string
  name: string
  /** Two or three words for the column header: "Decentralization", "Vault risk". */
  topic: string
  /** One line: what this feed looks at. */
  focus: string
  homepage: string
  methodologyUrl?: string
  /** false: the feed is not collected and does not appear. */
  enabled: boolean
}

/**
 * An independent measurement: a quantity, never a verdict.
 * Hand-maintained in adapters/metrics/<id>/metric.json.
 */
export interface Metric {
  id: string
  name: string
  homepage: string
}

/** A named part of an assessment, in the feed's own words. */
export interface Detail {
  name: string
  value: string
  description?: string
}

/**
 * What a feed adapter returns for one protocol. Every field is optional
 * because every feed publishes something different.
 */
export interface FeedResult {
  /** The feed's headline value, verbatim: "Stage 1", "4.8/10 · medium", "7 vaults rated". */
  value?: string
  /** The feed's own text about the protocol. */
  summary?: string
  /** Dimensions, vaults, sub-scores — whatever the feed breaks its assessment into. */
  details?: Detail[]
  /** When the feed itself last updated this assessment — not our fetch time. */
  updatedAt?: string
  /** The feed's page for this protocol. */
  url?: string
  /** What the data covers, or why there is none. */
  note?: string
  /** Additional source fields retained in JSON; some are displayed as structured details. */
  extra?: Record<string, unknown>
}

/** One protocol × one feed, as stored in data/protocols/<id>.json. */
export interface FeedData extends FeedResult {
  /** `ok` — the feed has data; `none` — it has none; `error` — we failed to read it. */
  status: 'ok' | 'none' | 'error'
  fetchedAt: string
}

/** An independent measurement (TVL, incidents) — a quantity, never a verdict. */
export interface MetricResult {
  value: number | null
  updatedAt?: string
  url?: string
  note?: string
  extra?: Record<string, unknown>
}

export interface MetricData extends MetricResult {
  fetchedAt: string
}

/**
 * data/protocols/<id>.json — everything we collected about one protocol.
 *
 * Generated, and generated only: the protocol's name, group and description are
 * hand-maintained in registry/protocols.json and never copied in here.
 */
export interface ProtocolRecord {
  generatedAt: string
  protocolId: string
  /** Keyed by metric id: `tvl`, `incidents`. */
  metrics: Record<string, MetricData>
  /** Keyed by feed id. */
  feeds: Record<string, FeedData>
}

/**
 * One dashboard row, as generated.
 *
 * It carries facts only — the TVL figure and, per feed, whether data exists.
 * Names and grouping come from the hand-maintained registry, and the values
 * themselves stay on the protocol page: feeds assess different things, so the
 * only thing they can be compared on across a row is whether data exists.
 */
export interface IndexRow {
  id: string
  tvl: number | null
  /** feed id -> true when that feed has data for this protocol. */
  feeds: Record<string, boolean>
}

/** data/index.json — one request, everything the dashboard needs at runtime. */
export interface IndexBundle {
  generatedAt: string
  rows: IndexRow[]
}

/** One line of data/changelog.json: a feed's value moved between two runs. */
export interface Change {
  ts: string
  protocolId: string
  protocolName: string
  feedId: string
  from: string | null
  to: string | null
}

/* ------------------------------------------------------- adapter contract */

export interface FetchOptions {
  /** How long a cached response stays usable. Default: one hour. */
  ttlSeconds?: number
  /** Ask for the first bytes only — some sources publish very large files. */
  rangeBytes?: [number, number]
  /** Treat 404 as an empty body instead of an error. */
  allowNotFound?: boolean
}

/**
 * Everything an adapter is allowed to touch. Adapters never call `fetch`
 * themselves — going through the context is what gives us the HTTP cache and
 * offline runs.
 */
export interface AdapterContext {
  getJson<T>(url: string, options?: FetchOptions): Promise<T>
  getText(url: string, options?: FetchOptions): Promise<string>
  log(message: string): void
  now: Date
}

/**
 * One source of data. The folder it lives in names it:
 * `adapters/feeds/<id>` for a column, `adapters/metrics/<id>` for a measurement.
 */
export interface Adapter<Result> {
  id: string
  /** Runs once per run. Fetch a listing here instead of once per protocol. */
  prepare?(ctx: AdapterContext): Promise<unknown>
  /**
   * Read one protocol. Return null when the source has nothing for it — that is
   * a normal answer, not a failure. Throw when the source could not be read.
   */
  collect(args: {
    protocol: Protocol
    ctx: AdapterContext
    prepared: unknown
  }): Promise<Result | null>
}

export type FeedAdapter = Adapter<FeedResult>
export type MetricAdapter = Adapter<MetricResult>
