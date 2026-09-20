import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Adapter, Feed, FeedAdapter, Metric, MetricAdapter, Protocol } from './types.ts'

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
  feeds: path.join(root, 'adapters', 'feeds'),
  metrics: path.join(root, 'adapters', 'metrics'),
  records: path.join(root, 'data', 'protocols'),
  index: path.join(root, 'data', 'index.json'),
  changelog: path.join(root, 'data', 'changelog.json'),
  cache: path.join(root, '.cache', 'http'),
  webData: path.join(root, 'apps', 'web', 'public', 'data'),
}

export interface Registry {
  protocols: Protocol[]
  /** Enabled feeds, each with the adapter that fills its column. */
  feeds: { feed: Feed; adapter: FeedAdapter }[]
  /** Independent measurements, each with the adapter that reads it. */
  metrics: { metric: Metric; adapter: MetricAdapter }[]
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

  const feeds: Registry['feeds'] = []
  for (const id of await folders(paths.feeds)) {
    const feed = await readJson<Feed>(path.join(paths.feeds, id, 'feed.json'))
    if (feed.id !== id) throw new Error(`adapters/feeds/${id}/feed.json declares id "${feed.id}"`)
    if (feed.enabled) feeds.push({ feed, adapter: await loadAdapter<FeedAdapter>(paths.feeds, id) })
  }

  const metrics: Registry['metrics'] = []
  for (const id of await folders(paths.metrics)) {
    const metric = await readJson<Metric>(path.join(paths.metrics, id, 'metric.json'))
    if (metric.id !== id)
      throw new Error(`adapters/metrics/${id}/metric.json declares id "${metric.id}"`)
    metrics.push({ metric, adapter: await loadAdapter<MetricAdapter>(paths.metrics, id) })
  }

  return { protocols, feeds, metrics }
}

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, 'utf8')) as T
}

async function folders(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort()
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
