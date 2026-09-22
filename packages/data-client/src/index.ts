import type { Change, IndexBundle, ProtocolRecord } from '@defi-dna/core/types'

export type {
  Change,
  Detail,
  ExtraData,
  ExtraFinding,
  ExtraIncident,
  ExtraReview,
  ExtraTvlComponent,
  ExtraVault,
  Feed,
  FeedData,
  IndexBundle,
  IndexRow,
  Metric,
  MetricData,
  Protocol,
  ProtocolRecord,
} from '@defi-dna/core/types'
export { formatUsd } from '@defi-dna/core/format'

/**
 * The read side of the data layer: the generated files, fetched at runtime.
 *
 * Where they live is itself runtime configuration. `config.json` is fetched
 * first and names the base URL, so one build can read the data sitting next to
 * it, or read it straight from the repository on GitHub, without rebuilding.
 *
 * Everything hand-maintained — protocol names, feed descriptions — is compiled
 * into the app instead; see the frontend's own registry module.
 */

let configUrl = '/config.json'
let base: Promise<string> | null = null

export function configureDataClient(options: { configUrl: string }): void {
  configUrl = options.configUrl
  base = null
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`${response.status} while loading ${url}`)
  return (await response.json()) as T
}

/** The configured data location, resolved once per page load. */
function dataBase(): Promise<string> {
  base ??= getJson<{ dataUrl?: string }>(configUrl)
    .catch(() => ({}) as { dataUrl?: string })
    .then(({ dataUrl }) => {
      const value = dataUrl?.trim() || './data'
      return new URL(value.endsWith('/') ? value : `${value}/`, new URL(configUrl, location.href))
        .href
    })
  return base
}

const cache = new Map<string, Promise<unknown>>()

/** Cached for the lifetime of the page: the data is a static snapshot. */
function load<T>(file: string): Promise<T> {
  const existing = cache.get(file) as Promise<T> | undefined
  if (existing) return existing
  const promise = dataBase().then((url) => getJson<T>(`${url}${file}`))
  cache.set(file, promise)
  return promise
}

/** Coverage for every protocol: one request, no values in it. */
export const loadIndex = (): Promise<IndexBundle> => load<IndexBundle>('index.json')

/** Everything we collected about one protocol, loaded when its page opens. */
export const loadProtocol = (id: string): Promise<ProtocolRecord> =>
  load<ProtocolRecord>(`protocols/${id}.json`)

export const loadChangelog = (): Promise<Change[]> =>
  load<Change[]>('changelog.json').catch(() => [])
