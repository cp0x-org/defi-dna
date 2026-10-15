import fs from 'node:fs/promises'
import path from 'node:path'
import { Http } from './http.ts'
import { dataPaths, loadRegistry, readJson, type Registry } from './registry.ts'
import { validateFeedData, validateMetricData } from './validate.ts'
import type {
  AdapterContext,
  Change,
  FeedData,
  Mapping,
  MetricsFile,
  ProtocolRecord,
  RunStatus,
  SourceStatus,
} from './types.ts'

export interface CollectOptions {
  /** Limit the run to these protocol ids. */
  protocols?: string[]
  /** Limit the run to these feed or metric ids. */
  sources?: string[]
  offline?: boolean
  verbose?: boolean
  /** Where the generated files live. Default: the repository's data/. */
  dataDir?: string
  /** The protocols and adapters to run. Default: whatever the adapter folders hold. */
  registry?: Registry
  /** Where the per-protocol progress line goes. Default: the console. */
  print?: (line: string) => void
}

export interface CollectSummary {
  records: ProtocolRecord[]
  changes: Change[]
  failures: string[]
}

/** Protocols in flight at once. Kept low to stay polite to third-party APIs. */
const CONCURRENCY = 4

/**
 * Run every adapter over every protocol and write data/protocols/<id>.json,
 * data/metrics.json and data/status.json.
 *
 * Three rules the rest of the system relies on:
 *  1. "The feed has nothing for this protocol" and "we failed to read the feed"
 *     are different answers (`none` vs `error`), and neither is a statement
 *     about the protocol.
 *  2. A failed read keeps the value from the previous run, so one bad response
 *     never empties a cell that is genuinely covered.
 *  3. A protocol record changes only when a feed's content does. Run times
 *     live in status.json and metrics, which move daily, in metrics.json — so
 *     the git history of a record is the history of what the feeds published.
 */
export async function collect(options: CollectOptions = {}): Promise<CollectSummary> {
  const registry = options.registry ?? (await loadRegistry())
  const data = dataPaths(options.dataDir)
  const print = options.print ?? console.log
  const now = new Date()
  const fetchedAt = now.toISOString()
  const http = new Http(options)

  const wanted = (id: string) => !options.sources || options.sources.includes(id)
  const feeds = registry.feeds.filter(({ feed }) => wanted(feed.id))
  const metrics = registry.metrics.filter(({ metric }) => wanted(metric.id))
  const protocols = registry.protocols.filter(
    (p) => !options.protocols || options.protocols.includes(p.id),
  )

  const context = (id: string, mapping: Mapping): AdapterContext => ({
    getJson: (url, opts) => http.getJson(url, opts),
    getText: (url, opts) => http.getText(url, opts),
    postJson: (url, body, opts) => http.postJson(url, body, opts),
    mapping,
    log: (message) => options.verbose && console.log(`  ${id}: ${message}`),
    now,
  })

  // One prepare() per adapter per run: fetch a listing once, not once per
  // protocol. An adapter that cannot start — a secret missing, a listing
  // unreachable — is skipped for the whole run: its column keeps the previous
  // values and the failure is reported once, not once per protocol.
  const prepared = new Map<string, unknown>()
  const skipped = new Map<string, string>()
  for (const { adapter, mapping } of [...feeds, ...metrics]) {
    const missing = options.offline
      ? []
      : (adapter.secrets ?? []).filter((name) => !process.env[name])
    if (missing.length > 0) {
      skipped.set(adapter.id, `${missing.join(', ')} is not set`)
    } else if (adapter.prepare) {
      try {
        prepared.set(adapter.id, await adapter.prepare(context(adapter.id, mapping)))
      } catch (error) {
        skipped.set(adapter.id, message(error))
      }
    }
  }
  const failures = [...skipped].map(([id, why]) => `${id}: skipped, ${why}`)
  const failed = new Map<string, number>()
  const fail = (sourceId: string, protocolId: string, error: unknown) => {
    failures.push(`${protocolId}/${sourceId}: ${message(error)}`)
    failed.set(sourceId, (failed.get(sourceId) ?? 0) + 1)
  }

  const feedIds = registry.feeds.map(({ feed }) => feed.id)
  const metricIds = registry.metrics.map(({ metric }) => metric.id)
  const metricsBefore = await readJson<MetricsFile>(data.metricsData).catch(
    () => ({}) as MetricsFile,
  )
  const metricsFile: MetricsFile = {}
  const changes: Change[] = []
  const records = await inParallel(protocols, CONCURRENCY, async (protocol) => {
    const previous = await readRecord(protocol.id, data.records)
    const record: ProtocolRecord = {
      protocolId: protocol.id,
      // A partial run (--protocol / --source) refreshes part of a record; the
      // rest is carried over so we never wipe a column we did not visit. A
      // disabled feed keeps its cells too; only a deleted folder drops them.
      feeds: carry(previous?.feeds, [...feedIds, ...registry.disabledFeeds]),
    }
    const measured = carry(metricsBefore[protocol.id], metricIds)
    metricsFile[protocol.id] = measured

    for (const { metric, adapter, mapping } of metrics) {
      const id = metric.id
      const before = measured[id]
      const unreadable = (why: string) => before ?? { value: null, fetchedAt, note: why }
      const skip = skipped.get(id)
      if (skip) {
        measured[id] = unreadable(skip)
        continue
      }
      try {
        const result = await adapter.collect({
          protocol,
          ctx: context(id, mapping),
          prepared: prepared.get(id),
        })
        const data = { ...(result ?? { value: null }), fetchedAt }
        const invalid = validateMetricData(data)
        if (invalid) throw new Error(`adapter output does not match the schema: ${invalid}`)
        measured[id] = data
      } catch (error) {
        fail(id, protocol.id, error)
        measured[id] = unreadable(message(error))
      }
    }

    for (const { feed, adapter, mapping } of feeds) {
      const before = previous?.feeds[feed.id]
      // `since` moves only when the content does: a cell re-read with the same
      // result keeps the time it was first seen like this.
      const stamp = (data: Omit<FeedData, 'since'>): FeedData =>
        before && sameContent(before, data)
          ? { ...data, since: before.since }
          : { ...data, since: fetchedAt }
      const unreadable = (why: string): FeedData =>
        before && before.status !== 'error' ? before : stamp({ status: 'error', note: why })
      const skip = skipped.get(feed.id)
      let data: FeedData
      if (skip) {
        data = unreadable(skip)
      } else {
        try {
          const result = await adapter.collect({
            protocol,
            ctx: context(feed.id, mapping),
            prepared: prepared.get(feed.id),
          })
          data = stamp(
            result
              ? { ...result, status: result.value ? 'ok' : 'none' }
              : { status: 'none', note: `${feed.name} has no data for ${protocol.name}.` },
          )
          const invalid = validateFeedData(data)
          if (invalid) throw new Error(`adapter output does not match the schema: ${invalid}`)
        } catch (error) {
          fail(feed.id, protocol.id, error)
          data = unreadable(message(error))
        }
      }
      record.feeds[feed.id] = data
      if ((before?.value ?? null) !== (data.value ?? null)) {
        changes.push({
          ts: fetchedAt,
          protocolId: protocol.id,
          protocolName: protocol.name,
          feedId: feed.id,
          from: before?.value ?? null,
          to: data.value ?? null,
        })
      }
    }

    await writeJson(path.join(data.records, `${record.protocolId}.json`), record)
    print(`  ${protocol.id.padEnd(14)} ${flags(record, feedIds)}`)
    return record
  })

  // Metrics for protocols this run did not visit are carried over as they were.
  for (const protocol of registry.protocols) {
    metricsFile[protocol.id] ??= carry(metricsBefore[protocol.id], metricIds)
  }
  await writeJson(data.metricsData, metricsFile)
  await writeStatus(
    data.status,
    [...feeds, ...metrics].map(({ adapter }) => adapter.id),
    [...feedIds, ...metricIds],
    (id) => {
      const skip = skipped.get(id)
      if (skip) return { note: skip }
      const count = failed.get(id) ?? 0
      return count > 0
        ? { note: `${count} of ${protocols.length} protocols could not be read.` }
        : { ok: true }
    },
    fetchedAt,
  )
  await appendChangelog(data.changelog, changes)
  return { records, changes, failures }
}

/**
 * data/status.json: when each source was last tried and last read cleanly.
 * Sources this run did not touch keep their entries; sources that left the
 * registry are dropped.
 */
async function writeStatus(
  file: string,
  ran: string[],
  known: string[],
  outcome: (id: string) => { ok?: boolean; note?: string },
  now: string,
): Promise<void> {
  const previous = await readJson<RunStatus>(file).catch(() => null)
  const sources: Record<string, SourceStatus> = {}
  for (const id of known) {
    const before = previous?.sources[id] ?? {}
    if (!ran.includes(id)) {
      if (Object.keys(before).length > 0) sources[id] = before
      continue
    }
    const { ok, note } = outcome(id)
    sources[id] = {
      lastRunAt: now,
      ...(ok ? { lastOkAt: now } : before.lastOkAt ? { lastOkAt: before.lastOkAt } : {}),
      ...(note ? { note } : {}),
    }
  }
  await writeJson(file, { generatedAt: now, sources } satisfies RunStatus)
}

/** Equal once `since` is set aside; key order and absent-vs-undefined do not count. */
function sameContent(before: FeedData, data: Omit<FeedData, 'since'>): boolean {
  const rest: Record<string, unknown> = { ...before }
  delete rest['since']
  return canonical(rest) === canonical(data)
}

const canonical = (value: unknown): string => JSON.stringify(sortKeys(value))

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])]),
    )
  }
  return value
}

/** `[##.]` — one mark per feed column, in registry order. */
function flags(record: ProtocolRecord, feedIds: string[]): string {
  const mark = (id: string) => {
    const status = record.feeds[id]?.status
    return status === 'ok' ? '#' : status === 'error' ? '!' : '.'
  }
  return `[${feedIds.map(mark).join('')}]`
}

export async function readRecord(
  protocolId: string,
  records: string = dataPaths().records,
): Promise<ProtocolRecord | null> {
  try {
    return await readJson<ProtocolRecord>(path.join(records, `${protocolId}.json`))
  } catch {
    return null
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

/** Keep stored values for the ids we are not refreshing; drop ids that left the registry. */
function carry<T>(stored: Record<string, T> | undefined, ids: string[]): Record<string, T> {
  const out: Record<string, T> = {}
  for (const id of ids) {
    const value = stored?.[id]
    if (value !== undefined) out[id] = value
  }
  return out
}

const MAX_CHANGES = 1000

/** The change log is append-only: it is the history of what the feeds published. */
async function appendChangelog(file: string, changes: Change[]): Promise<void> {
  if (changes.length === 0) return
  const existing = await readJson<Change[]>(file).catch(() => [] as Change[])
  await writeJson(file, [...changes, ...existing].slice(0, MAX_CHANGES))
}

async function inParallel<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (let i = next++; i < items.length; i = next++) {
        results[i] = await run(items[i] as T)
      }
    }),
  )
  return results
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))
