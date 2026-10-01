import { formatUsd, type Detail, type FeedAdapter, type FeedResult } from '@defi-dna/core'
import mapping from './mapping.json' with { type: 'json' }

const API = 'https://pigi.finance/api/v1'
const SITE = 'https://app.pigi.finance'
/** pigi recomputes ratings nightly, and the free plan allows 1,000 requests a month. */
const TTL = 12 * 3600
/**
 * The largest page the API serves. A page takes ~10 s whatever its size, so the
 * largest page means the fewest requests; the occasional 504 is retried by the
 * HTTP layer and does not count against the quota.
 */
const PAGE = 1000
const MAX_PAGES = 5
const ETHEREUM = 1
/** Vaults listed individually on the protocol page, largest by TVL. */
const TOP_VAULTS = 10

/**
 * our protocol id -> the `protocol_name` pigi files the vaults under. pigi uses
 * one name per product line or version ("Morpho" and "Morpho v2", "SparkLend"
 * and "Spark"), so a row takes exactly the names it lists.
 */
const table: Record<string, string | string[]> = mapping
const names = (id: string): string[] => {
  const value = table[id]
  return value == null ? [] : typeof value === 'string' ? [value] : value
}

/** The fields of pigi's Vault object this adapter reads. */
export interface Vault {
  strategy_id: number
  protocol_name: string
  chain_id: number
  pool_name: string
  display_name: string | null
  type: string | null
  tvl_30d_ma: number | null
  updated_at: string | null
  risk_band: string | null
  risk_score: number | null
}

interface Listing {
  data?: Vault[]
  pagination?: { hasMore?: boolean }
}

/** `display_name` is unique across pigi's catalogue; it is null for a vault added since the last nightly. */
const vaultName = (vault: Vault): string => vault.display_name ?? vault.pool_name

/**
 * pigi publishes a rating row together with the day's data, so the date of the
 * newest data point is the rating date — checked against `/vaults/:id/risk`.
 */
const ratedOn = (vault: Vault): string => (vault.updated_at ?? '').slice(0, 10)

/** `B · 77/100` — the band and the score, exactly as published. */
const verdict = (vault: Vault): string =>
  [vault.risk_band, vault.risk_score == null ? null : `${vault.risk_score}/100`]
    .filter(Boolean)
    .join(' · ')

/** What pigi publishes about the vaults filed under `pigiNames`. */
export function assess(pigiNames: string[], listed: Vault[]): FeedResult {
  const scope = pigiNames.join(', ')
  // pigi has no page per protocol; each vault in `extra` links its own.
  const url = `${SITE}/vaults`

  if (listed.length === 0) {
    return { url, note: `pigi lists no Ethereum vault under ${scope}.` }
  }
  const rated = listed
    .filter((vault) => vault.risk_band)
    .sort((a, b) => (b.tvl_30d_ma ?? 0) - (a.tvl_30d_ma ?? 0))
  if (rated.length === 0) {
    return {
      url,
      note: `pigi lists ${listed.length} Ethereum vault(s) under ${scope} and has published a rating for none of them.`,
    }
  }

  const details: Detail[] = rated.slice(0, TOP_VAULTS).map((vault) => ({
    name: vaultName(vault),
    value: verdict(vault),
    description: [
      `Filed under ${vault.protocol_name}`,
      vault.type,
      formatUsd(vault.tvl_30d_ma) ? `TVL ${formatUsd(vault.tvl_30d_ma)} (30-day average)` : null,
      ratedOn(vault) ? `Rated ${ratedOn(vault)}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }))

  const updatedAt = rated.map(ratedOn).filter(Boolean).sort().at(-1)

  return {
    value: `${rated.length} vaults rated`,
    summary: `pigi.finance rates individual vaults rather than protocols. It rates ${rated.length} of the ${listed.length} Ethereum vault(s) it files under ${scope}.`,
    details,
    ...(updatedAt ? { updatedAt } : {}),
    url,
    note:
      `Counted: ${rated.length} rated of the ${listed.length} Ethereum vault(s) pigi lists under ${scope}. ` +
      `Bands run A (safest) to F and scores 0–100, higher = safer. No vault stands in for the ` +
      `protocol and nothing is averaged — pigi publishes no protocol-level rating.`,
    extra: {
      vaultsListed: listed.length,
      vaultsRated: rated.length,
      vaults: rated.map((vault) => ({
        name: vaultName(vault),
        version: vault.protocol_name,
        curator: null,
        tier: vault.risk_band,
        score: vault.risk_score,
        tvlUsd: vault.tvl_30d_ma,
        scoredAt: ratedOn(vault) || null,
        url: `${SITE}/vault/${vault.strategy_id}`,
      })),
    },
  }
}

/**
 * pigi.finance — risk ratings for individual vaults, lending reserves and pools.
 *
 * pigi rates vaults, not protocols, and files each under a `protocol_name`.
 * "Aave" holds only v3 pools (Core, Lido, Horizon, plus sGHO) and "Uniswap" only
 * v3 pools (fee tiers, 20-byte pool addresses), so they fill the v3 rows.
 *
 * The data API needs a key (PIGI_API_KEY), traded for an hour-long token. The
 * free plan allows 1,000 requests a month, so the run reads one listing of every
 * Ethereum vault in prepare() — two pages today — and nothing per vault: the
 * listing already carries the published band and score. The token is minted
 * only when that listing is not in the HTTP cache, so --offline needs no key.
 */
const adapter: FeedAdapter = {
  id: 'pigi',

  async prepare(ctx): Promise<Map<string, Vault[]>> {
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

    const rows: Vault[] = []
    for (let page = 0; page < MAX_PAGES; page++) {
      const query = new URLSearchParams({
        chain_id: String(ETHEREUM),
        sort: 'id_asc',
        limit: String(PAGE),
        offset: String(page * PAGE),
      })
      const body = await ctx.getJson<Listing>(`${API}/vaults?${query}`, {
        ttlSeconds: TTL,
        headers,
      })
      rows.push(...(body.data ?? []))
      if (!body.pagination?.hasMore) break
    }

    const wanted = new Set(Object.keys(table).flatMap(names))
    const byName = new Map<string, Vault[]>()
    for (const vault of rows) {
      if (vault.chain_id !== ETHEREUM || !wanted.has(vault.protocol_name)) continue
      byName.set(vault.protocol_name, [...(byName.get(vault.protocol_name) ?? []), vault])
    }
    ctx.log(
      `${rows.length} Ethereum vaults listed, ${rows.filter((v) => v.risk_band).length} rated`,
    )
    const missing = [...wanted].filter((name) => !byName.has(name))
    // A renamed protocol would otherwise look like a coverage gap.
    if (missing.length > 0) ctx.log(`mapped but not listed: ${missing.join(', ')}`)
    return byName
  },

  async collect({ protocol, prepared }): Promise<FeedResult | null> {
    const pigiNames = names(protocol.id)
    if (pigiNames.length === 0) return null

    const listing = prepared as Map<string, Vault[]> | undefined
    if (!listing) throw new Error('pigi vault listing unavailable')

    return assess(
      pigiNames,
      pigiNames.flatMap((name) => listing.get(name) ?? []),
    )
  },
}

export default adapter
