import type {
  Change,
  IndexBundle,
  MetricsFile,
  ProtocolDetail,
  ProtocolRecord,
} from '@defi-dna/core/types'

export type {
  AssessedObject,
  Change,
  Detail,
  ExtraData,
  ExtraFinding,
  ExtraIncident,
  ExtraGovernanceBody,
  ExtraReview,
  ExtraTvlComponent,
  ExtraVault,
  Feed,
  FeedData,
  IndexBundle,
  IndexRow,
  Metric,
  MetricData,
  MetricsFile,
  Protocol,
  ProtocolDetail,
  ProtocolRecord,
  Reading,
  SourceStatus,
  StatusRule,
} from '@defi-dna/core/types'
export { formatDuration, formatUsd } from '@defi-dna/core/format'
export { readStatus, readValue, statusWord } from '@defi-dna/core/status'

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

/** Measured quantities for every protocol: one small file that moves every day. */
export const loadMetrics = (): Promise<MetricsFile> =>
  load<MetricsFile>('metrics.json').catch(() => ({}) as MetricsFile)

/** Everything we collected about one protocol, loaded when its page opens. */
export const loadProtocol = (id: string): Promise<ProtocolDetail> =>
  Promise.all([load<ProtocolRecord>(`protocols/${id}.json`), loadMetrics()]).then(
    ([record, metrics]) => ({ ...record, metrics: metrics[id] ?? {} }),
  )

/** A log we could not read is reported as such — never as an empty log. */
export const loadChangelog = (): Promise<Change[]> => load<Change[]>('changelog.json')
