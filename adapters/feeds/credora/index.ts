import type { Detail, FeedAdapter, FeedResult } from '@defi-dna/core'

/** Documented: POST only, authenticated with a `ClientSecret` header. */
const API = 'https://api.credora.io/graphql'
const SITE = 'https://app.credora.network'
/** The public list of rated vaults; Credora documents no page per vault. */
const VAULTS = `${SITE}/vaults`
/**
 * Every online run asks the API afresh: there is no published quota, the run
 * makes one request, and the schedule is at most twice a day. The copy on disk
 * serves --offline, fixtures and a run whose network failed.
 */
const TTL = 0
/** The documented maximum of `limit`. */
const PAGE = 1000
const MAX_PAGES = 5
const ETHEREUM = 1
/** Vaults listed individually on the protocol page. */
const TOP_VAULTS = 10
/** Vaults carried into `extra`. Keeps a record of a big protocol well under ~200 KB. */
const MAX_VAULTS = 100

/** One item of the unified `ratings` query, the fields this adapter reads. */
export interface Rating {
  id: string | null
  address: string | null
  name: string
  chainId: number
  protocol: string
  /** "indicative" or "commissioned", in Credora's own terms. */
  ratingType: string | null
  /** "vaults", "markets", ... — the API spells it in either case. */
  product: string | null
  curator: { name: string | null } | null
  Metrics: {
    /** A+ … D on Credora's DeFi Rating Scale. */
    rating: string
    /** Probability of Significant Loss, as published: a fraction, annualized. */
    psl: number | null
    /** YYYY-MM-DD; the documentation itself shows a malformed one. */
    publishDate: string | null
  }
}

interface RatingsResponse {
  data?: { ratings?: { totalCount: number; items: Rating[] } }
  errors?: { message: string }[]
}

/** Ethereum vaults by Credora's protocol name, lower-case. */
export type VaultsByProtocol = Map<string, Rating[]>

const query = (page: number): string =>
  `{ ratings(filter: { chainId: [${ETHEREUM}] }, page: ${page}, limit: ${PAGE}) { totalCount ` +
  'items { id address name chainId protocol ratingType product curator { name } ' +
  'Metrics { rating psl publishDate } } } }'

/** The feed's date, only when it is one: `2025-19-09` appears in Credora's own examples. */
export const publishedOn = (vault: Rating): string | null => {
  const date = vault.Metrics.publishDate ?? ''
  const parts = /^\d{4}-(\d{2})-(\d{2})$/.exec(date)
  if (!parts) return null
  const month = Number(parts[1])
  const day = Number(parts[2])
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? date : null
}

/** `A- · PSL 0.00428` — the rating and the probability behind it, exactly as published. */
const verdict = (vault: Rating): string =>
  vault.Metrics.psl == null
    ? vault.Metrics.rating
    : `${vault.Metrics.rating} · PSL ${vault.Metrics.psl}`

const ratingType = (vault: Rating): string => vault.ratingType?.toLowerCase() ?? 'unstated'

/**
 * Credora — DeFi credit ratings for individual vaults.
 *
 * Credora rates vaults, lending markets and assets, not protocols, on one
 * scale (A+ … D) derived from the annualized Probability of Significant Loss.
 * This adapter reads the vaults only: a row takes every Ethereum vault filed
 * under the Credora protocol name(s) `mapping.json` gives it, and its headline
 * is how many there are. No vault stands in for the protocol.
 *
 * The API is GraphQL behind a whitelisted key (CREDORA_API_KEY, header
 * `ClientSecret`). One query per run, in prepare(), filtered to Ethereum
 * server-side; the product filter is applied here because the documentation
 * spells `vaults` in either case. The response is kept on disk for --offline,
 * which needs no key; an online run without the key skips the feed.
 */
const adapter: FeedAdapter<VaultsByProtocol> = {
  id: 'credora',
  secrets: ['CREDORA_API_KEY'],

  async prepare(ctx): Promise<VaultsByProtocol> {
    const apiKey = process.env.CREDORA_API_KEY
    const headers = async () => {
      if (!apiKey) throw new Error('CREDORA_API_KEY is not set')
      return { ClientSecret: apiKey }
    }

    const listed: Rating[] = []
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await ctx.postJson<RatingsResponse>(
        API,
        { query: query(page) },
        { ttlSeconds: TTL, headers },
      )
      // GraphQL reports a refused query with HTTP 200; the message names the cause, never the key.
      if (body.errors?.length) {
        throw new Error(`Credora: ${body.errors.map((error) => error.message).join('; ')}`)
      }
      const items = body.data?.ratings?.items ?? []
      listed.push(...items)
      if (items.length < PAGE) break
    }

    const vaults: VaultsByProtocol = new Map()
    for (const item of listed) {
      if (item.chainId !== ETHEREUM || item.product?.toLowerCase() !== 'vaults') continue
      const key = item.protocol.toLowerCase()
      vaults.set(key, [...(vaults.get(key) ?? []), item])
    }
    const counted = [...vaults.values()].reduce((sum, rows) => sum + rows.length, 0)
    ctx.log(
      `${listed.length} ratings listed, ${counted} Ethereum vault(s) under ${vaults.size} protocol(s)`,
    )
    // A renamed protocol would otherwise look like a coverage gap.
    const missing = Object.values(ctx.mapping)
      .flat()
      .filter((id) => !vaults.has(id))
    if (missing.length > 0) ctx.log(`mapped but without Ethereum vaults: ${missing.join(', ')}`)
    return vaults
  },

  async collect({ protocol, ctx, prepared }): Promise<FeedResult | null> {
    const mapped = ctx.mapping[protocol.id] ?? []
    if (mapped.length === 0) return null

    const filed = mapped.map((id) => `"${id}"`).join(', ')
    // By name: an order by rating would read as a ranking of ours.
    const vaults = mapped
      .flatMap((id) => prepared.get(id) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name))
    if (vaults.length === 0) {
      return {
        url: VAULTS,
        note:
          `Credora publishes no Ethereum vault rating under ${filed}. ` +
          'Markets and assets it also rates are not shown here.',
      }
    }

    const details: Detail[] = vaults.slice(0, TOP_VAULTS).map((vault) => ({
      name: vault.name,
      value: verdict(vault),
      description: [
        vault.curator?.name ? `Curated by ${vault.curator.name}` : null,
        `${ratingType(vault)} rating`,
        publishedOn(vault) ? `Published ${publishedOn(vault)}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }))

    const byType = new Map<string, number>()
    for (const vault of vaults)
      byType.set(ratingType(vault), (byType.get(ratingType(vault)) ?? 0) + 1)
    const types = [...byType].map(([type, count]) => `${count} ${type}`).join(', ')
    const updatedAt = vaults.map(publishedOn).filter(Boolean).sort().at(-1)
    const omitted = Math.max(0, vaults.length - MAX_VAULTS)

    return {
      value: `${vaults.length} vault${vaults.length === 1 ? '' : 's'} rated`,
      details,
      ...(updatedAt ? { updatedAt } : {}),
      url: VAULTS,
      note:
        `Counted: ${vaults.length} Ethereum vault(s) Credora files under ${filed} with product ` +
        `"vaults": ${types}. No vault stands in for the protocol and nothing is averaged — ` +
        'Credora publishes no protocol-level rating. Markets and assets it also rates are not shown.' +
        (omitted > 0
          ? ` The first ${MAX_VAULTS} by name are listed here; ${omitted} more are at the source.`
          : ''),
      extra: {
        facts: [
          { name: 'Credora protocol', value: mapped.join(', ') },
          { name: 'Vaults rated', value: String(vaults.length) },
          ...[...byType].map(([type, count]) => ({
            name: `${type[0]?.toUpperCase()}${type.slice(1)} ratings`,
            value: String(count),
          })),
          {
            name: 'PSL (the Score column)',
            value:
              'Probability of Significant Loss — annualized probability of a 1% loss on market supply',
          },
        ],
        vaults: vaults.slice(0, MAX_VAULTS).map((vault) => ({
          name: vault.name,
          version: null,
          curator: vault.curator?.name ?? null,
          tier: vault.Metrics.rating,
          score: vault.Metrics.psl,
          tvlUsd: null,
          scoredAt: publishedOn(vault),
          // Credora documents no page per vault; the fragment keeps each row's link distinct.
          url: `${VAULTS}#${encodeURIComponent(vault.address ?? vault.name)}`,
        })),
      },
    }
  },
}

export default adapter
