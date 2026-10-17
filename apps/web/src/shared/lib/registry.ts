import type { Feed, Metric, Protocol } from '@defi-dna/data'
import protocolsFile from '../../../../../registry/protocols.json' with { type: 'json' }

/**
 * The hand-maintained half of the data, compiled into the app at build time.
 *
 * Protocol names, groups and feed descriptions are written by people and live
 * in the repository: `registry/protocols.json` and the `feed.json` / `metric.json`
 * next to each adapter. The generated half — what the feeds actually published —
 * is fetched at runtime instead.
 */
export const protocols: Protocol[] = protocolsFile.protocols

const protocolsById = new Map(protocols.map((protocol) => [protocol.id, protocol]))
export const protocolById = (id: string): Protocol | undefined => protocolsById.get(id)

/** `_template` and anything else underscored is a template, not a live source. */
const collect = <T extends { id: string }>(modules: Record<string, { default: T }>): T[] =>
  Object.entries(modules)
    .filter(([path]) => !path.includes('/_'))
    .map(([, module]) => module.default)
    .sort((a, b) => a.id.localeCompare(b.id))

/**
 * The JSON is taken to be a Feed or a Metric here without a check: the
 * pipeline's registry loader and `npm test` validate every feed.json and
 * metric.json before a build can ship them.
 */
export const feeds: Feed[] = collect(
  import.meta.glob<{ default: Feed }>('../../../../../adapters/feeds/*/feed.json', { eager: true }),
).filter((feed) => feed.enabled)

const feedsById = new Map(feeds.map((feed) => [feed.id, feed]))
export const feedById = (id: string): Feed | undefined => feedsById.get(id)
/** A feed's display name; the id itself for a feed that is no longer connected. */
export const feedName = (id: string): string => feedById(id)?.name ?? id

export const metrics: Metric[] = collect(
  import.meta.glob<{ default: Metric }>('../../../../../adapters/metrics/*/metric.json', {
    eager: true,
  }),
)

/** Ids of the metric adapters the pages read by name: adapters/metrics/<id>. */
export const TVL_METRIC = 'tvl'
export const INCIDENTS_METRIC = 'incidents'
