import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  ASSESSED_OBJECTS,
  type Adapter,
  type Feed,
  type FeedAdapter,
  type Mapping,
  type Metric,
  type MetricAdapter,
  type Protocol,
} from './types.ts'
import { checkStatusRule } from './status.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Every path the pipeline touches.
 *
 * `registry/` and the adapter folders are hand-maintained; everything under
 * `data/` is generated and overwritten by a run.
 */
export const paths = {
  root,
  protocols: path.join(root, 'registry', 'protocols.json'),
  /** Names the data repository the deployed site and `pull` read from. */
  config: path.join(root, 'configs', 'config.json'),
  feeds: path.join(root, 'adapters', 'feeds'),
  metrics: path.join(root, 'adapters', 'metrics'),
  data: path.join(root, 'data'),
  cache: path.join(root, '.cache', 'http'),
  webData: path.join(root, 'apps', 'web', 'public', 'data'),
}

/** The generated files under one data directory: the repository's `data/` unless a caller (a test) says otherwise. */
export function dataPaths(dir: string = paths.data) {
  return {
    dir,
    records: path.join(dir, 'protocols'),
    metricsData: path.join(dir, 'metrics.json'),
    status: path.join(dir, 'status.json'),
    index: path.join(dir, 'index.json'),
    changelog: path.join(dir, 'changelog.json'),
  }
}

export interface Registry {
  protocols: Protocol[]
  /** Enabled feeds, each with the adapter that fills its column and its mapping. */
  feeds: { feed: Feed; adapter: FeedAdapter; mapping: Mapping }[]
  /** Independent measurements, each with the adapter that reads it and its mapping. */
  metrics: { metric: Metric; adapter: MetricAdapter; mapping: Mapping }[]
  /**
   * Feeds switched off with `enabled: false`: not collected and not shown, but
   * their stored cells are kept so switching one back on resumes from its last
   * read. Deleting a feed's folder is what drops its cells.
   */
  disabledFeeds: string[]
}

/**
 * The registry is the protocol list plus whatever adapter folders exist.
 *
 * A folder is the unit: `adapters/feeds/<id>` holds `feed.json` (what the feed
 * is), `mapping.json` (our protocol id -> the feed's id) and `index.ts` (how to
 * read it). Copying a folder is how a feed is added — there is no list of feeds
 * to keep in sync anywhere else.
 */
export async function loadRegistry(): Promise<Registry> {
  const { protocols } = await readJson<{ protocols: Protocol[] }>(paths.protocols)
  const known = new Set(protocols.map((protocol) => protocol.id))

  const feeds: Registry['feeds'] = []
  const disabledFeeds: string[] = []
  for (const id of await listAdapters(paths.feeds)) {
    const folder = path.join(paths.feeds, id)
    const feed = await readJson<Feed>(path.join(folder, 'feed.json'))
    if (feed.id !== id) throw new Error(`adapters/feeds/${id}/feed.json declares id "${feed.id}"`)
    if (!ASSESSED_OBJECTS.includes(feed.assesses)) {
      throw new Error(
        `adapters/feeds/${id}/feed.json: "assesses" must be one of ${ASSESSED_OBJECTS.join(', ')}`,
      )
    }
    if (feed.status) checkStatusRule(id, feed.status)
    if (!feed.enabled) {
      disabledFeeds.push(id)
      continue
    }
    feeds.push({
      feed,
      adapter: await loadAdapter<FeedAdapter>(paths.feeds, id),
      mapping: await readMapping(folder, known),
    })
  }

  const metrics: Registry['metrics'] = []
  for (const id of await listAdapters(paths.metrics)) {
    const folder = path.join(paths.metrics, id)
    const metric = await readJson<Metric>(path.join(folder, 'metric.json'))
    if (metric.id !== id)
      throw new Error(`adapters/metrics/${id}/metric.json declares id "${metric.id}"`)
    metrics.push({
      metric,
      adapter: await loadAdapter<MetricAdapter>(paths.metrics, id),
      mapping: await readMapping(folder, known),
    })
  }

  return { protocols, feeds, metrics, disabledFeeds }
}

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, 'utf8')) as T
}

/** Adapter folders under `adapters/feeds` or `adapters/metrics`; `_`-prefixed ones are templates. */
export async function listAdapters(group: string): Promise<string[]> {
  const entries = await fs.readdir(group, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort()
}

/**
 * The folder's mapping.json, normalized. A folder without one gets an empty
 * mapping; a key that is not a registry protocol id is an error, because a
 * typo there would otherwise be stored as "the feed has no data" — a coverage
 * fact we never observed.
 */
export async function readMapping(folder: string, known: ReadonlySet<string>): Promise<Mapping> {
  const file = path.join(folder, 'mapping.json')
  let raw: unknown
  try {
    raw = JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
  return normalizeMapping(raw, known, path.relative(root, file))
}

/**
 * `{ "aave-v3": "aave" }` and `{ "aave-v3": ["aave", "aave-prime"] }` both become
 * `{ "aave-v3": [...] }`. Keys starting with `_` are comments.
 */
export function normalizeMapping(
  raw: unknown,
  known?: ReadonlySet<string>,
  where = 'mapping.json',
): Mapping {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${where} must be an object of protocol id -> source id(s)`)
  }
  const mapping: Mapping = {}
  for (const [id, value] of Object.entries(raw)) {
    if (id.startsWith('_')) continue
    if (known && !known.has(id)) {
      throw new Error(`${where}: "${id}" is not a protocol id in registry/protocols.json`)
    }
    const list = typeof value === 'string' ? [value] : value
    if (
      !Array.isArray(list) ||
      list.length === 0 ||
      !list.every((v) => typeof v === 'string' && v)
    ) {
      throw new Error(`${where}: "${id}" must map to a non-empty string or a list of them`)
    }
    mapping[id] = list as string[]
  }
  return mapping
}

async function loadAdapter<A extends Adapter<unknown>>(group: string, id: string): Promise<A> {
  const file = path.join(group, id, 'index.ts')
  const module = (await import(pathToFileURL(file).href)) as { default?: A }
  const adapter = module.default
  if (!adapter || adapter.id !== id || typeof adapter.collect !== 'function') {
    throw new Error(`${file} must default-export an adapter with id "${id}" and a collect()`)
  }
  return adapter
}
