import type { Feed, Metric, Protocol } from '@defi-dna/data'
import protocolsFile from '../../../../registry/protocols.json'

/**
 * The hand-maintained half of the data, compiled into the app at build time.
 *
 * Protocol names, groups and feed descriptions are written by people and live
 * in the repository: `registry/protocols.json` and the `feed.json` / `metric.json`
 * next to each adapter. The generated half — what the feeds actually published —
 * is fetched at runtime instead.
 */
export const protocols: Protocol[] = protocolsFile.protocols

const byId = new Map(protocols.map((protocol) => [protocol.id, protocol]))
export const protocolById = (id: string): Protocol | undefined => byId.get(id)

/** `_template` and anything else underscored is a template, not a live source. */
const collect = <T extends { id: string }>(modules: Record<string, { default: T }>): T[] =>
  Object.entries(modules)
    .filter(([path]) => !path.includes('/_'))
    .map(([, module]) => module.default)
    .sort((a, b) => a.id.localeCompare(b.id))

export const feeds: Feed[] = collect<Feed>(
  import.meta.glob('../../../../adapters/feeds/*/feed.json', { eager: true }),
).filter((feed) => feed.enabled)

export const metrics: Metric[] = collect<Metric>(
  import.meta.glob('../../../../adapters/metrics/*/metric.json', { eager: true }),
)
