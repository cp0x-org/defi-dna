import fs from 'node:fs/promises'
import path from 'node:path'
import { Http } from './http.ts'
import { loadRegistry, paths, readJson } from './registry.ts'
import type { AdapterContext, Change, FeedData, Mapping, ProtocolRecord } from './types.ts'

export interface CollectOptions {
  /** Limit the run to these protocol ids. */
  protocols?: string[]
  /** Limit the run to these feed or metric ids. */
  sources?: string[]
  offline?: boolean
  verbose?: boolean
}

export interface CollectSummary {
  records: ProtocolRecord[]
  changes: Change[]
  failures: string[]
}

/** Protocols in flight at once. Kept low to stay polite to third-party APIs. */
const CONCURRENCY = 4

/**
 * Run every adapter over every protocol and write data/protocols/<id>.json.
 *
 * Two rules the rest of the system relies on:
 *  1. "The feed has nothing for this protocol" and "we failed to read the feed"
 *     are different answers (`none` vs `error`), and neither is a statement
 *     about the protocol.
 *  2. A failed read keeps the value from the previous run, so one bad response
 *     never empties a cell that is genuinely covered.
 */
export async function collect(options: CollectOptions = {}): Promise<CollectSummary> {
  const registry = await loadRegistry()
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
    postJson: (url, body) => http.postJson(url, body),
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

  const feedIds = registry.feeds.map(({ feed }) => feed.id)
  const metricIds = registry.metrics.map(({ metric }) => metric.id)
  const changes: Change[] = []
  const records = await inParallel(protocols, CONCURRENCY, async (protocol) => {
    const previous = await readRecord(protocol.id)
    const record: ProtocolRecord = {
      generatedAt: fetchedAt,
      protocolId: protocol.id,
      // A partial run (--protocol / --source) refreshes part of a record; the
      // rest is carried over so we never wipe a column we did not visit.
      metrics: carry(previous?.metrics, metricIds),
      feeds: carry(previous?.feeds, feedIds),
    }

    for (const { metric, adapter, mapping } of metrics) {
      const id = metric.id
      const before = previous?.metrics[id]
      const unreadable = (why: string) => before ?? { value: null, fetchedAt, note: why }
      const skip = skipped.get(id)
      if (skip) {
        record.metrics[id] = unreadable(skip)
        continue
      }
      try {
        const result = await adapter.collect({
          protocol,
          ctx: context(id, mapping),
          prepared: prepared.get(id),
        })
        record.metrics[id] = { ...(result ?? { value: null }), fetchedAt }
      } catch (error) {
        failures.push(`${protocol.id}/${id}: ${message(error)}`)
        record.metrics[id] = unreadable(message(error))
      }
    }

    for (const { feed, adapter, mapping } of feeds) {
      const before = previous?.feeds[feed.id]
      const unreadable = (why: string): FeedData =>
        before && before.status !== 'error' ? before : { status: 'error', fetchedAt, note: why }
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
          data = result
            ? { ...result, status: result.value ? 'ok' : 'none', fetchedAt }
            : { status: 'none', fetchedAt, note: `${feed.name} has no data for ${protocol.name}.` }
        } catch (error) {
          failures.push(`${protocol.id}/${feed.id}: ${message(error)}`)
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

    await writeRecord(record)
    console.log(`  ${protocol.id.padEnd(14)} ${flags(record, feedIds)}`)
    return record
  })

  await appendChangelog(changes)
  return { records, changes, failures }
}

/** `[##.]` — one mark per feed column, in registry order. */
function flags(record: ProtocolRecord, feedIds: string[]): string {
  const mark = (id: string) => {
    const status = record.feeds[id]?.status
    return status === 'ok' ? '#' : status === 'error' ? '!' : '.'
  }
  return `[${feedIds.map(mark).join('')}]`
}

export async function readRecord(protocolId: string): Promise<ProtocolRecord | null> {
  try {
    return await readJson<ProtocolRecord>(path.join(paths.records, `${protocolId}.json`))
  } catch {
    return null
  }
}

async function writeRecord(record: ProtocolRecord): Promise<void> {
  await fs.mkdir(paths.records, { recursive: true })
  await fs.writeFile(
    path.join(paths.records, `${record.protocolId}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8',
  )
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
async function appendChangelog(changes: Change[]): Promise<void> {
  if (changes.length === 0) return
  const existing = await readJson<Change[]>(paths.changelog).catch(() => [] as Change[])
  const merged = [...changes, ...existing].slice(0, MAX_CHANGES)
  await fs.writeFile(paths.changelog, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
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
