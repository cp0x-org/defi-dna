import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bundle } from './bundle.ts'
import { collect } from './collect.ts'
import type { Registry } from './registry.ts'
import type {
  Change,
  Feed,
  FeedAdapter,
  FeedResult,
  Metric,
  MetricAdapter,
  MetricsFile,
  ProtocolRecord,
  RunStatus,
} from './types.ts'

/**
 * The collector over a fake registry in a temporary data directory. These are
 * the charter's guarantees as tests: none is not error, a failed read keeps
 * the previous value, a record changes only when a feed's content does.
 */
let dir: string
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'defi-dna-'))
})
afterEach(() => fs.rm(dir, { recursive: true, force: true }))

const protocols = [
  { id: 'p1', name: 'P1', category: 'lending' },
  { id: 'p2', name: 'P2', category: 'dex' },
]
const feed = (id: string): Feed => ({
  id,
  name: id.toUpperCase(),
  topic: 'Topic',
  focus: 'Focus.',
  assesses: 'protocol',
  homepage: 'https://example.com',
  enabled: true,
})
const metric = (id: string): Metric => ({ id, name: id, homepage: 'https://example.com' })

/** A feed that answers per protocol id; `undefined` means "not covered". */
const answering = (
  id: string,
  answers: Record<string, FeedResult | (() => never)>,
  extra: Partial<FeedAdapter> = {},
) => ({
  feed: feed(id),
  mapping: {},
  adapter: {
    id,
    ...extra,
    collect: async ({ protocol }) => {
      const answer = answers[protocol.id]
      if (typeof answer === 'function') answer()
      return answer ?? null
    },
  } as FeedAdapter,
})

const registry = (
  feeds: Registry['feeds'],
  metrics: Registry['metrics'] = [],
  disabledFeeds: string[] = [],
): Registry => ({ protocols, feeds, metrics, disabledFeeds })

const run = (reg: Registry, options: Parameters<typeof collect>[0] = {}) =>
  collect({ dataDir: dir, registry: reg, print: () => {}, ...options })

const read = async <T>(file: string): Promise<T> =>
  JSON.parse(await fs.readFile(path.join(dir, file), 'utf8')) as T
const record = (id: string) => read<ProtocolRecord>(`protocols/${id}.json`)

const A: FeedResult = { value: 'A', url: 'https://example.com/p1' }
const B: FeedResult = { value: 'B', url: 'https://example.com/p1' }
const boom = () => {
  throw new Error('boom')
}

describe('collect', () => {
  it('stores a value as ok, nothing as none, and logs the first value', async () => {
    const summary = await run(registry([answering('f1', { p1: A })]))
    expect(summary.failures).toEqual([])
    expect((await record('p1')).feeds['f1']).toMatchObject({ status: 'ok', value: 'A' })
    expect((await record('p2')).feeds['f1']).toMatchObject({
      status: 'none',
      note: 'F1 has no data for P2.',
    })
    expect(await read<Change[]>('changelog.json')).toMatchObject([
      { protocolId: 'p1', feedId: 'f1', from: null, to: 'A' },
    ])
    const status = await read<RunStatus>('status.json')
    expect(status.sources['f1']?.lastOkAt).toBe(status.generatedAt)
  })

  it('keeps the previous value when a read fails and counts the failure once per cell', async () => {
    await run(registry([answering('f1', { p1: A })]))
    const first = (await record('p1')).feeds['f1']
    const summary = await run(registry([answering('f1', { p1: boom, p2: boom })]))
    // Protocols run in parallel, so the failures arrive in completion order.
    expect([...summary.failures].sort()).toEqual(['p1/f1: boom', 'p2/f1: boom'])
    const cell = (await record('p1')).feeds['f1']
    expect(cell).toEqual(first) // value, status and since all kept
    expect((await read<RunStatus>('status.json')).sources['f1']).toMatchObject({
      lastOkAt: first?.since,
      note: '2 of 2 protocols could not be read.',
    })
    expect(await read<Change[]>('changelog.json')).toHaveLength(1)
  })

  it('skips the whole column when prepare() fails or a secret is missing', async () => {
    await run(registry([answering('f1', { p1: A })]))
    const failing = registry([answering('f1', { p1: B }, { prepare: async () => boom() })])
    expect((await run(failing)).failures).toEqual(['f1: skipped, boom'])
    expect((await record('p1')).feeds['f1']?.value).toBe('A')

    const keyed = registry([answering('f1', { p1: B }, { secrets: ['DEFI_DNA_TEST_NOPE'] })])
    expect((await run(keyed)).failures).toEqual(['f1: skipped, DEFI_DNA_TEST_NOPE is not set'])
    expect((await record('p1')).feeds['f1']?.value).toBe('A')
    // Offline, a secret is never needed: the adapter runs from the cache.
    expect((await run(keyed, { offline: true })).failures).toEqual([])
    expect((await record('p1')).feeds['f1']?.value).toBe('B')
  })

  it('moves since only when the content changes, whatever the key order', async () => {
    const first = await run(registry([answering('f1', { p1: A })]))
    const before = (await record('p1')).feeds['f1']
    await run(registry([answering('f1', { p1: { url: A.url, value: 'A' } })]))
    expect((await record('p1')).feeds['f1']).toEqual(before)
    expect(await read<Change[]>('changelog.json')).toHaveLength(1)

    const third = await run(registry([answering('f1', { p1: B })]))
    const after = (await record('p1')).feeds['f1']
    // Stamped with this run's time; two runs may share a millisecond, so compare to the run.
    expect(after?.since).toBe((await read<RunStatus>('status.json')).generatedAt)
    expect(third.changes).toMatchObject([{ from: 'A', to: 'B' }])
    expect(first.changes).toHaveLength(1)
    expect((await read<Change[]>('changelog.json')).map((c) => c.to)).toEqual(['B', 'A'])
  })

  it('leaves the columns a partial run did not visit untouched', async () => {
    const tvl: { metric: Metric; adapter: MetricAdapter; mapping: Record<string, string[]> } = {
      metric: metric('tvl'),
      mapping: {},
      adapter: {
        id: 'tvl',
        collect: async ({ protocol }) => ({ value: protocol.id === 'p1' ? 5 : null }),
      },
    }
    await run(registry([answering('f1', { p1: A })], [tvl]))
    const untouchable = registry([answering('f1', { p1: boom, p2: boom })], [tvl])
    const summary = await run(untouchable, { sources: ['tvl'] })
    expect(summary.failures).toEqual([])
    expect((await record('p1')).feeds['f1']?.value).toBe('A')
    expect((await read<MetricsFile>('metrics.json'))['p1']?.['tvl']?.value).toBe(5)
  })

  it('keeps the cells of a disabled feed and drops those of a removed one', async () => {
    await run(registry([answering('f1', { p1: A }), answering('f2', { p1: B })]))
    await run(registry([answering('f1', { p1: A })], [], ['f2']))
    expect(Object.keys((await record('p1')).feeds)).toEqual(['f1', 'f2'])
    await run(registry([answering('f1', { p1: A })]))
    expect(Object.keys((await record('p1')).feeds)).toEqual(['f1'])
  })

  it('rejects output the schema does not allow and keeps the previous value', async () => {
    await run(registry([answering('f1', { p1: A })]))
    const wrong = registry([answering('f1', { p1: { value: 42 } as unknown as FeedResult })])
    const summary = await run(wrong)
    expect(summary.failures[0]).toContain('does not match the schema')
    expect((await record('p1')).feeds['f1']?.value).toBe('A')
  })
})

describe('bundle', () => {
  it('joins coverage, TVL and the run status into index.json', async () => {
    const tvl: { metric: Metric; adapter: MetricAdapter; mapping: Record<string, string[]> } = {
      metric: metric('tvl'),
      mapping: {},
      adapter: {
        id: 'tvl',
        collect: async ({ protocol }) => ({ value: protocol.id === 'p1' ? 5 : null }),
      },
    }
    const reg = registry([answering('f1', { p1: A })], [tvl])
    await run(reg)
    const web = path.join(dir, 'web')
    const { bundle: index } = await bundle({ dataDir: dir, webDir: web, registry: reg })
    expect(index.rows).toEqual([
      { id: 'p1', tvl: 5, feeds: { f1: true } },
      { id: 'p2', tvl: null, feeds: { f1: false } },
    ])
    expect(index.sources?.['f1']?.lastOkAt).toBe(index.generatedAt)
    expect((await fs.readdir(web)).sort()).toEqual([
      'changelog.json',
      'index.json',
      'metrics.json',
      'protocols',
    ])
  })
})
