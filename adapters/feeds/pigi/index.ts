import { formatUsd, type Detail, type FeedAdapter, type FeedResult } from '@defi-dna/core'

const API = 'https://pigi.finance/api/v1'
const SITE = 'https://app.pigi.finance'
/** pigi recomputes ratings nightly, and the free plan allows 1,000 requests a month. */
const TTL = 12 * 3600
/**
 * Only Ethereum vaults enter the vault term. pigi documents `chain_id` as
 * narrowing the vault set only: the node's own rating is the same on every chain.
 */
const ETHEREUM = 1
const LISTING = `${API}/protocols?chain_id=${ETHEREUM}`
const nodeUrl = (nodeId: string) => `${API}/protocols/${nodeId}?chain_id=${ETHEREUM}`
/**
 * pigi has no public page per protocol; the API answers only with a key. The
 * card links the public documentation of the rating we read instead.
 */
const DOCS = `${SITE}/defi-api-docs#api-v1-protocols-node-id`
/** Vaults carried into `extra`, largest by TVL. Keeps a record of a big protocol under ~100 KB. */
const MAX_VAULTS = 100

/** A vault that counted toward a node, as `/protocols/:node_id` lists it. */
export interface NodeVault {
  strategy_id: number
  name: string
  protocol_name: string
  score: number
  band: string
  date: string
  tvl_usd: number | null
}

/** The fields of pigi's ProtocolRating (`/protocols/:node_id`) this adapter reads. */
export interface Node {
  node_id: string
  label: string | null
  score: number
  band: string
  /** The last date the number could have changed: the node's rating date or the newest vault row. */
  date: string
  applied: { k1: number; k2: number; vault_aggregation: string }
  protocol: { rating: number; date: string; methodology_version?: string }
  vaults: {
    rated_count: number
    stale_excluded?: number
    tvl_usd: number
    score_tvl_weighted: number | null
    bands?: Record<string, number>
    items?: NodeVault[]
  }
  formula?: { note?: string }
  /** pigi's own remark, present only when no rated vault counted. */
  note?: string
}

/** A row of `/protocols`: enough to list a node beside the row's headline. */
export interface ListedNode {
  node_id: string
  label: string | null
  score: number
  band: string
  date: string
}

export interface Prepared {
  /** The nodes `/protocols` lists, by id; a mapped id outside it is not fetched. */
  listed: Map<string, ListedNode>
  headers: () => Promise<Record<string, string>>
}

/** `B 82.23/100` — the band and the score, exactly as published. */
const verdict = (node: ListedNode): string => `${node.band} ${node.score}/100`

/** The two terms pigi publishes behind the score and the weights it applied, each explained. */
const breakdown = ({ node_id, protocol: own, vaults, applied, note }: Node): Detail[] => [
  {
    name: 'Node rating',
    value: `${own.rating}/100`,
    description:
      `pigi’s own rating of ${node_id} itself, 0–100, higher = safer. Its rubric covers audits ` +
      `and bounty, admin and pause authority, operational history and scale. Rated ${own.date}` +
      (own.methodology_version ? `, methodology ${own.methodology_version}.` : '.') +
      ` Weight in the score: ${applied.k1}.`,
  },
  ...(vaults.score_tvl_weighted == null
    ? []
    : [
        {
          name: 'Vault score, TVL-weighted',
          value: String(vaults.score_tvl_weighted),
          description: [
            `The mean of pigi’s latest scores of the ${vaults.rated_count} rated Ethereum vault(s) ` +
              `that deposit into ${node_id}, weighted by their 30-day average TVL` +
              (formatUsd(vaults.tvl_usd) ? ` (${formatUsd(vaults.tvl_usd)} in all).` : '.') +
              ` Weight in the score: ${applied.k2}.`,
            vaults.bands
              ? `Vaults by band: ${Object.entries(vaults.bands)
                  .map(([band, count]) => `${band} ${count}`)
                  .join(', ')}.`
              : null,
            vaults.stale_excluded
              ? `${vaults.stale_excluded} vault(s) left out as stale (no rating for over a week).`
              : null,
          ]
            .filter(Boolean)
            .join(' '),
        },
      ]),
  {
    name: 'Weights',
    value: `node ${applied.k1} · vaults ${applied.k2}`,
    description:
      `pigi’s fixed formula: score = ${applied.k1} × node rating + ${applied.k2} × vault score. ` +
      `With no rated vault the node rating stands alone.${note ? ` ${note}` : ''}`,
  },
]

/**
 * What pigi publishes about the nodes filed under `nodeIds`. `node` is the
 * headline, read in full; `others` are the row's other rated nodes, listed
 * beside it with their own score and never combined with it.
 */
export function assess(
  nodeIds: string[],
  node: Node | null,
  others: ListedNode[] = [],
): FeedResult {
  if (!node) return { note: `pigi publishes no protocol rating for ${nodeIds.join(', ')}.` }

  const shown = [node, ...others].map((listed) => listed.node_id)
  const unlisted = nodeIds.filter((id) => !shown.includes(id))
  const vaults = [...(node.vaults.items ?? [])].sort((a, b) => (b.tvl_usd ?? 0) - (a.tvl_usd ?? 0))
  const omitted = Math.max(0, vaults.length - MAX_VAULTS)

  return {
    value: verdict(node),
    ...(node.label ? { summary: node.label } : {}),
    details: breakdown(node),
    updatedAt: node.date,
    url: DOCS,
    note:
      `Headline: ${node.node_id}.` +
      (others.length > 0
        ? ` Also rated, shown separately: ${others.map((other) => other.node_id).join(', ')}.`
        : '') +
      (unlisted.length > 0 ? ` Not rated by pigi: ${unlisted.join(', ')}.` : '') +
      ' Vault score counts Ethereum vaults only.' +
      (omitted > 0 ? ` Top ${MAX_VAULTS} vaults by TVL shown, ${omitted} more at pigi.` : ''),
    extra: {
      // No link: pigi has no public page for these nodes either.
      ...(others.length > 0
        ? {
            facts: others.map((other) => ({
              name: other.label ?? other.node_id,
              value: `${verdict(other)} · ${other.date}`,
            })),
          }
        : {}),
      vaults: vaults.slice(0, MAX_VAULTS).map((vault) => ({
        name: vault.name,
        version: vault.protocol_name,
        curator: null,
        tier: vault.band,
        score: vault.score,
        // Whole dollars: the cents are noise that would change the record every run.
        tvlUsd: vault.tvl_usd == null ? null : Math.round(vault.tvl_usd),
        scoredAt: vault.date,
        url: `${SITE}/vault/${vault.strategy_id}`,
      })),
      // pigi asks for the formula to be quoted wherever the number is republished.
      ...(node.formula?.note ? { text: [node.formula.note] } : {}),
    },
  }
}

/**
 * pigi.finance — cumulative protocol ratings.
 *
 * pigi rates vaults, and rates protocols as the dependency nodes the vaults
 * deposit into. `/protocols` publishes one score per node: 0.6 × the node's own
 * rating + 0.4 × the TVL-weighted mean of the latest scores of the rated vaults
 * that deposit into it. The weights are pigi's, fixed and echoed in `formula`,
 * so the number is carried as pigi's own.
 *
 * `mapping.json` names the nodes a row takes, the headline first: Aave v3 is
 * Core, then Prime and Horizon; Morpho Vaults is Vaults V2, then MetaMorpho V1
 * and V1.1. The headline is read in full from `/protocols/:node_id`; the
 * others come from the listing and are shown separately, never combined.
 *
 * The data API needs a key (PIGI_API_KEY), traded for an hour-long token. The
 * run reads the node listing in prepare() and one `/protocols/:node_id` per
 * covered row in collect() — twelve requests today, about 730 a month at two
 * runs a day against the free plan's 1,000. The token is minted only when a
 * request misses the HTTP cache, so --offline needs no key; an online run
 * without the key skips pigi and keeps the previous values.
 */
const adapter: FeedAdapter<Prepared> = {
  id: 'pigi',
  secrets: ['PIGI_API_KEY'],

  async prepare(ctx): Promise<Prepared> {
    const apiKey = process.env.PIGI_API_KEY
    let token: Promise<string> | undefined
    const headers = async () => {
      if (!apiKey) throw new Error('PIGI_API_KEY is not set')
      token ??= ctx
        .postJson<{ token: string }>(`${API}/auth/token`, { apiKey })
        .then((body) => body.token)
        .catch((error: unknown) => {
          token = undefined // let a retry mint again
          throw error
        })
      return { authorization: `Bearer ${await token}` }
    }

    const body = await ctx.getJson<{ data?: ListedNode[] }>(LISTING, { ttlSeconds: TTL, headers })
    const listed = new Map((body.data ?? []).map((node) => [node.node_id, node]))
    ctx.log(`${listed.size} protocol nodes rated`)
    // A renamed node would otherwise look like a coverage gap.
    const missing = Object.values(ctx.mapping)
      .flat()
      .filter((id) => !listed.has(id))
    if (missing.length > 0) ctx.log(`mapped but not listed: ${missing.join(', ')}`)
    return { listed, headers }
  },

  async collect({ protocol, ctx, prepared }): Promise<FeedResult | null> {
    const nodeIds = ctx.mapping[protocol.id] ?? []
    if (nodeIds.length === 0) return null

    // The first rated node in mapping order is the headline. An unlisted node is
    // never asked for: its 404 would still count against the quota.
    const [headline, ...others] = nodeIds.flatMap((id) => prepared.listed.get(id) ?? [])
    const node = headline
      ? await ctx.getJson<Node>(nodeUrl(headline.node_id), {
          ttlSeconds: TTL,
          headers: prepared.headers,
        })
      : null
    return assess(nodeIds, node, others)
  },
}

export default adapter
