import { formatUsd, type Detail, type FeedAdapter, type FeedResult } from '@defi-dna/core'

const API = 'https://api.philidor.io/v1'
const SITE = 'https://analytics.philidor.io'
const DAY = 86_400
/** Anonymous access returns at most 100 rows per request. */
const PAGE = 100
const MAX_PAGES = 5
/** Vaults listed individually on the protocol page, largest by TVL. */
const TOP_VAULTS = 10
/** Vaults carried into `extra`, largest by TVL. Keeps a record of a big protocol under ~100 KB. */
const MAX_VAULTS = 100

interface Vault {
  address: string
  name: string
  protocol_version: string | null
  tvl_usd: number | string | null
  total_score: number | string | null
  risk_tier: string | null
  is_shutdown?: boolean
  curator_name?: string | null
  score_computed_at?: string | null
  last_synced_at?: string | null
}

type VaultsByProtocol = Map<string, Vault[]>

const number = (value: unknown): number | null => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const scoredAt = (vault: Vault): string =>
  (vault.score_computed_at ?? vault.last_synced_at ?? '').slice(0, 10)

/** `Prime 8.88` — the two things Philidor publishes about a vault. */
const verdict = (vault: Vault): string => {
  const score = number(vault.total_score)
  return score == null ? (vault.risk_tier ?? 'unrated') : `${vault.risk_tier} ${score.toFixed(2)}`
}

/**
 * Philidor Analytics — resilience scores for individual vaults.
 *
 * Philidor rates vaults, not protocols, and files each vault under a protocol
 * and a version (`v3`, `v3-lido`, `v4`). Our rows are versions too, so a row
 * takes exactly the vaults filed under its own version: nothing from Aave v4
 * ever lands in the Aave v3 row.
 *
 * Shut-down vaults are left out of the count and said so in the note — they are
 * still listed by Philidor, so the number would otherwise not add up against
 * their site.
 *
 * Anonymous access is rate-limited, so the vault list is pulled once per run in
 * prepare() and the per-protocol pass touches no network.
 *
 * `mapping.json` names the vaults that belong to a row as `<philidor protocol>`
 * or `<philidor protocol>:<protocol_version>`; without a version the entry
 * takes every version Philidor files.
 */
const adapter: FeedAdapter<VaultsByProtocol> = {
  id: 'philidor',

  async prepare(ctx): Promise<VaultsByProtocol> {
    const wanted = new Set(
      Object.values(ctx.mapping)
        .flat()
        .map((entry) => entry.split(':')[0] as string),
    )
    const vaults: VaultsByProtocol = new Map()
    for (const philidorId of wanted) {
      const rows: Vault[] = []
      for (let page = 1; page <= MAX_PAGES; page++) {
        const query = new URLSearchParams({
          protocol: philidorId,
          chain: 'Ethereum',
          limit: String(PAGE),
          page: String(page),
          sortBy: 'tvl_usd',
          sortOrder: 'desc',
        })
        const body = await ctx.getJson<{ data?: Vault[]; meta?: { totalPages?: number } }>(
          `${API}/vaults?${query}`,
          { ttlSeconds: DAY },
        )
        rows.push(...(body.data ?? []))
        if (page >= (body.meta?.totalPages ?? 1)) break
      }
      vaults.set(philidorId, rows)
      ctx.log(`${philidorId}: ${rows.length} Ethereum vaults`)
    }
    return vaults
  },

  async collect({ protocol, ctx, prepared: listing }): Promise<FeedResult | null> {
    const mapped = ctx.mapping[protocol.id] ?? []
    if (mapped.length === 0) return null

    const philidorId = mapped[0]?.split(':')[0] as string
    const versions = mapped
      .map((entry) => entry.split(':')[1])
      .filter((version): version is string => Boolean(version))
    const url = `${SITE}/protocols/${philidorId}`

    const listed = mapped.flatMap((entry) => {
      const [id, version] = entry.split(':')
      const all = listing.get(id as string) ?? []
      return version ? all.filter((vault) => vault.protocol_version === version) : all
    })
    const live = listed.filter((vault) => !vault.is_shutdown)
    const rated = live
      .filter((vault) => vault.risk_tier)
      .sort((a, b) => (number(b.tvl_usd) ?? 0) - (number(a.tvl_usd) ?? 0))

    if (rated.length === 0) {
      return {
        url,
        note: `Philidor rates no live Ethereum vault under ${mapped.join(', ')}.`,
      }
    }

    const details: Detail[] = rated.slice(0, TOP_VAULTS).map((vault) => ({
      name: vault.name,
      value: verdict(vault),
      description: [
        `Version ${vault.protocol_version ?? 'unspecified'}`,
        vault.curator_name ? `Curated by ${vault.curator_name}` : null,
        formatUsd(number(vault.tvl_usd)) ? `TVL ${formatUsd(number(vault.tvl_usd))}` : null,
        scoredAt(vault) ? `Scored ${scoredAt(vault)}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }))

    const shutdown = listed.length - live.length
    const omitted = Math.max(0, rated.length - MAX_VAULTS)
    const updatedAt = rated.map(scoredAt).filter(Boolean).sort().at(-1)
    const scope = versions.length ? `version ${versions.join(', ')}` : 'every version it files'

    return {
      value: `${rated.length} vaults rated`,
      summary: `Philidor scores individual vaults rather than protocols. It rates ${rated.length} live Ethereum vault(s) of ${philidorId} (${scope}).`,
      details,
      ...(updatedAt ? { updatedAt } : {}),
      url,
      note:
        `Counted: ${rated.length} of the ${live.length} live vault(s) Philidor lists for ` +
        `${philidorId} under ${scope}` +
        (shutdown > 0 ? `, with ${shutdown} shut-down vault(s) left out` : '') +
        `. No vault stands in for the protocol and nothing is averaged — Philidor publishes no protocol-level score.` +
        (omitted > 0
          ? ` The ${MAX_VAULTS} largest by TVL are listed here; ${omitted} more are at the source.`
          : ''),
      extra: {
        philidorId,
        versions,
        vaultsListed: listed.length,
        vaultsLive: live.length,
        vaultsShutdown: shutdown,
        vaultsRated: rated.length,
        vaults: rated.slice(0, MAX_VAULTS).map((vault) => ({
          name: vault.name,
          version: vault.protocol_version,
          curator: vault.curator_name ?? null,
          tier: vault.risk_tier,
          score: number(vault.total_score),
          tvlUsd: number(vault.tvl_usd),
          scoredAt: scoredAt(vault) || null,
          url: `${SITE}/vault/ethereum/${vault.address}`,
        })),
      },
    }
  },
}

export default adapter
