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
 * What a feed's values are about. A feed that grades vaults says nothing about
 * the protocol as a whole, and the dashboard says so next to every value.
 */
export const ASSESSED_OBJECTS = [
  'protocol',
  'deployment',
  'vault',
  'vault-protocol',
  'pool',
  'asset',
  'research',
] as const
export type AssessedObject = (typeof ASSESSED_OBJECTS)[number]

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
  /** The object the feed assesses: the protocol, each deployment, individual vaults, ... */
  assesses: AssessedObject
  homepage: string
  methodologyUrl?: string
  /** false: the feed is not collected and does not appear. */
  enabled: boolean
  /** How the feed's own published scale reads, when it says. Absent: no colour beyond neutral. */
  status?: StatusRule
  /**
   * The same, applied to each entry of `details` — for a feed that grades parts
   * of its assessment on its own scale and publishes no grade for the whole.
   */
  detailStatus?: StatusRule
}

/** The feed's own characterization of a value, never ours. */
export const READINGS = ['positive', 'neutral', 'negative'] as const
export type Reading = (typeof READINGS)[number]

/**
 * How to read a feed's headline as the feed itself characterizes it — its own
 * colour band, risk level word or graded band, each of which the feed defines.
 * Declared only where the feed publishes that meaning; we set no threshold.
 */
export interface StatusRule {
  /** One sentence for readers: what the feed publishes and how it reads. Shown next to the colour. */
  rule: string
  /** A regular expression over the headline `value`; its first group is the feed's own word or band. */
  match: string
  /** That word or band, lower-case, to the feed's own characterization. Anything else stays neutral. */
  values: Record<string, Reading>
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

export interface ExtraReview {
  file: string
  stage: string
  risks: string[]
  date: string | null
  url: string
}

export interface ExtraFinding {
  title: string
  severity: string | null
  category: string | null
  description: string | null
}

/** A multisig read on-chain: how many of its signers an action needs. */
export interface ExtraMultisig {
  name: string
  address: string
  threshold: number
  signers: number
}

export interface ExtraVault {
  name: string
  version: string | null
  curator: string | null
  tier: string | null
  score: number | null
  tvlUsd: number | null
  scoredAt: string | null
  url: string
}

export interface ExtraIncident {
  date: string
  name: string
  amountUsd: number | null
  classification: string
  technique: string
  returnedFunds: number | null
  source: string | null
}

export interface ExtraTvlComponent {
  id: string
  name: string
  tvl: number | null
}

/**
 * Structured data beyond the headline, in the shapes the protocol page can
 * render. The shapes are generic — a list of facts, a table of vaults — so a
 * new feed picks from them; only a genuinely new shape needs a new type here,
 * a schema entry and a component.
 */
export interface ExtraData {
  /** Facts about the record in the source's own terms: "Vaults listed: 197", "Risk level: medium". */
  facts?: Detail[]
  /** Reviews the source files separately under this row, one deployment each. */
  reviews?: ExtraReview[]
  /** Findings the source reports, with its own severity and category. */
  findings?: ExtraFinding[]
  /** Individually rated vaults, largest first. */
  vaults?: ExtraVault[]
  incidents?: ExtraIncident[]
  components?: ExtraTvlComponent[]
  /** Multisigs the governance metric read, each with its threshold and signer count. */
  multisigs?: ExtraMultisig[]
  /** Optional feed- or metric-supplied paragraphs; never synthesized by us. */
  text?: string[]
}

/**
 * What a feed adapter returns for one protocol. Every field is optional
 * because every feed publishes something different.
 */
export interface FeedResult {
  /** The feed's headline value, verbatim: "20 admins · $116M capital at risk", "4.8/10 · medium". */
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
  /** Structured optional fields, defined in schemas/protocol-record.schema.json. */
  extra?: ExtraData
}

/** One protocol × one feed, as stored in data/protocols/<id>.json. */
export interface FeedData extends FeedResult {
  /** `ok` — the feed has data; `none` — it has none; `error` — we failed to read it. */
  status: 'ok' | 'none' | 'error'
  /**
   * The run that last changed this cell. Content that stayed the same keeps
   * its earlier time, so a record changes only when a feed's content does and
   * the git history of the data is the history of what the feeds published.
   */
  since: string
}

/** An independent measurement (TVL, incidents) — a quantity, never a verdict. */
export interface MetricResult {
  value: number | null
  updatedAt?: string
  url?: string
  note?: string
  extra?: ExtraData
}

export interface MetricData extends MetricResult {
  /** When we read it. Metrics move daily, so this is refreshed on every run. */
  fetchedAt: string
}

/**
 * data/protocols/<id>.json — what every feed published about one protocol.
 *
 * Generated, and generated only: the protocol's name, group and description are
 * hand-maintained in registry/protocols.json and never copied in here. The
 * file changes only when a feed's content does; measured quantities, which
 * move every day, live in data/metrics.json.
 */
export interface ProtocolRecord {
  protocolId: string
  /** Keyed by feed id. */
  feeds: Record<string, FeedData>
}

/** data/metrics.json — measured quantities for every protocol, by protocol id then metric id. */
export type MetricsFile = Record<string, Record<string, MetricData>>

/** What the protocol page renders: the record joined with the protocol's metrics. */
export interface ProtocolDetail extends ProtocolRecord {
  /** Keyed by metric id: `tvl`, `incidents`. null when metrics.json could not be read. */
  metrics: Record<string, MetricData> | null
}

/** When we last read a source. Facts about this pipeline, never about a protocol. */
export interface SourceStatus {
  /** The last run that tried the source. */
  lastRunAt?: string
  /** The last run that read it without a failure. */
  lastOkAt?: string
  /** Why the last run fell short, when it did. */
  note?: string
}

/** data/status.json — the last run, and when each source was last read. */
export interface RunStatus {
  generatedAt: string
  sources: Record<string, SourceStatus>
}

/**
 * One dashboard row, as generated.
 *
 * It carries the TVL figure and, per feed, whether data exists and how the feed
 * itself reads its value. Names and grouping come from the hand-maintained
 * registry, and the values themselves stay on the protocol page: feeds assess
 * different things on different scales, so a row never puts them side by side.
 */
export interface IndexRow {
  id: string
  tvl: number | null
  /** feed id -> true when that feed has data for this protocol. */
  feeds: Record<string, boolean>
  /**
   * feed id -> the feed's own reading of its headline, where its feed.json
   * states how its scale reads. Absent for a feed with no data or no reading.
   * Older bundles have no field at all; read that as "no reading".
   */
  readings?: Record<string, Reading>
}

/** data/index.json — one request, everything the dashboard needs at runtime. */
export interface IndexBundle {
  /** When the data was collected. */
  generatedAt: string
  /** When each feed and metric was last read; absent when the run status is not available. */
  sources?: Record<string, SourceStatus>
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

/**
 * adapters/<kind>/<id>/mapping.json, normalized: our protocol id -> the
 * source's own id(s) for it. Every value is a list, and every key was checked
 * against registry/protocols.json when the registry loaded.
 */
export type Mapping = Record<string, string[]>

export interface FetchOptions {
  /** How long a cached response stays usable. Default: one hour. */
  ttlSeconds?: number
  /** Ask for the first bytes only — some sources publish very large files. */
  rangeBytes?: [number, number]
  /** Treat 404 as an empty body instead of an error. */
  allowNotFound?: boolean
  /**
   * Extra request headers, such as a bearer token. A function is called only
   * when the request really goes to the network, so a cached or offline read
   * never mints a credential. Headers take no part in the cache key.
   */
  headers?: () => Promise<Record<string, string>>
}

/**
 * Options of a POST. With `ttlSeconds` the response is cached on disk under the
 * URL and the body, like a GET, so a query API (GraphQL) replays offline and
 * serves fixtures; without it the response never touches the disk.
 */
export type PostOptions = Pick<FetchOptions, 'ttlSeconds' | 'headers'>

/**
 * Everything an adapter is allowed to touch. Adapters never call `fetch`
 * themselves — going through the context is what gives us the HTTP cache and
 * offline runs.
 */
export interface AdapterContext {
  getJson<T>(url: string, options?: FetchOptions): Promise<T>
  getText(url: string, options?: FetchOptions): Promise<string>
  /**
   * POST a JSON body and read JSON back. Without `ttlSeconds` it is never
   * cached: that form exchanges credentials. With it, the response is cached
   * like a GET, for an API that answers queries only to POST.
   */
  postJson<T>(url: string, body: unknown, options?: PostOptions): Promise<T>
  /** This adapter's mapping.json. Empty when the folder has none. */
  mapping: Mapping
  log(message: string): void
  now: Date
}

/**
 * One source of data. The folder it lives in names it:
 * `adapters/feeds/<id>` for a column, `adapters/metrics/<id>` for a measurement.
 *
 * `Prepared` is whatever `prepare()` returns; declare it (`FeedAdapter<Map<…>>`)
 * and `collect()` receives it typed.
 */
export interface Adapter<Result, Prepared = unknown> {
  id: string
  /**
   * Environment variables the source needs, such as an API key. When one is
   * missing the adapter is skipped for the run — its column keeps the previous
   * values and the run reports it once. `--offline` reads need no secret.
   */
  secrets?: string[]
  /**
   * Runs once per run. Fetch a listing here instead of once per protocol. If
   * it throws, collect() is not called: the whole column keeps the previous
   * run's values and the failure is reported once.
   */
  prepare?(ctx: AdapterContext): Promise<Prepared>
  /**
   * Read one protocol. Return null when the source has nothing for it — that is
   * a normal answer, not a failure. Throw when the source could not be read.
   */
  collect(args: {
    protocol: Protocol
    ctx: AdapterContext
    prepared: Prepared
  }): Promise<Result | null>
}

export type FeedAdapter<Prepared = unknown> = Adapter<FeedResult, Prepared>
export type MetricAdapter<Prepared = unknown> = Adapter<MetricResult, Prepared>
