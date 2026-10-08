import type { Detail, FeedAdapter, FeedResult } from '@defi-dna/core'
import mapping from './mapping.json' with { type: 'json' }

const API = 'https://defiscoring.com/api/score'
const SITE = 'https://defiscoring.com/protocols'
const DAY = 86_400
/**
 * Anonymous access is limited to 30 requests/minute per IP. Space fetches so a
 * full prepare stays under that ceiling even when the runner is otherwise busy.
 */
const GAP_MS = 2_100

/** our protocol id -> DeFi Scoring protocol slug */
const table: Record<string, string> = mapping

interface Pillar {
  weight?: number
  value?: number
  real?: boolean
  detail?: string
  audit_count?: number
  age_days?: number | null
  tvl_usd?: number
  tvl_change_7d_pct?: number
}

interface ScoreResponse {
  success?: boolean
  protocol?: { slug?: string; name?: string; category?: string }
  score?: number
  band?: string
  pillars?: Record<string, Pillar>
  methodology?: string
  sources?: string[]
  timestamp?: string
  disclaimer?: string
}

type Prepared = Map<string, ScoreResponse | null>

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const title = (key: string): string => key.charAt(0).toUpperCase() + key.slice(1)

const pillarDescription = (pillar: Pillar): string | undefined => {
  const parts: string[] = []
  if (pillar.detail) parts.push(pillar.detail)
  if (pillar.real === false) parts.push('real: false')
  if (pillar.audit_count != null) parts.push(`audit_count: ${pillar.audit_count}`)
  if (pillar.age_days != null) parts.push(`age_days: ${pillar.age_days}`)
  if (pillar.tvl_change_7d_pct != null) parts.push(`tvl_change_7d_pct: ${pillar.tvl_change_7d_pct}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** Map one API payload into the fields we store for a protocol cell. */
export const assess = (slug: string, data: ScoreResponse): FeedResult => {
  const url = `${SITE}/${slug}`
  if (!data.success || typeof data.score !== 'number' || !Number.isFinite(data.score)) {
    return { url, note: `DeFi Scoring has published no score for ${slug}.` }
  }

  const band = data.band?.trim()
  const details: Detail[] = Object.entries(data.pillars ?? {}).flatMap(([key, pillar]) => {
    if (typeof pillar.value !== 'number' || !Number.isFinite(pillar.value)) return []
    const description = pillarDescription(pillar)
    return [
      {
        name: title(key),
        value: String(pillar.value),
        ...(description ? { description } : {}),
      },
    ]
  })

  const unreal = Object.entries(data.pillars ?? {})
    .filter(([, pillar]) => pillar.real === false)
    .map(([key, pillar]) => (pillar.detail ? `${title(key)} (${pillar.detail})` : title(key)))

  const notes: string[] = []
  if (unreal.length > 0) {
    notes.push(`Pillars marked real: false — ${unreal.join('; ')}.`)
  }
  if (data.sources?.length) notes.push(`Sources named by DeFi Scoring: ${data.sources.join(', ')}.`)

  const updatedAt = data.timestamp?.slice(0, 10)
  return {
    value: band ? `${data.score} · ${band}` : String(data.score),
    ...(data.methodology ? { summary: data.methodology } : {}),
    details,
    ...(updatedAt ? { updatedAt } : {}),
    url,
    ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
    extra: {
      overallScore: data.score,
      riskLevel: band ?? null,
      ...(data.disclaimer ? { text: [data.disclaimer] } : {}),
    },
  }
}

/**
 * DeFi Scoring — protocol risk score with Trust / Liveness / Security pillars.
 *
 * Scores are pulled once per run in prepare(), spaced to respect the anonymous
 * 30 req/min IP limit. collect() only reads that map, so the parallel protocol
 * pass never bursts the API.
 */
const adapter: FeedAdapter = {
  id: 'defiscoring',

  async prepare(ctx): Promise<Prepared> {
    const slugs = [...new Set(Object.values(table))]
    const scores: Prepared = new Map()

    for (let i = 0; i < slugs.length; i++) {
      if (i > 0) await wait(GAP_MS)
      const slug = slugs[i] as string
      const body = await ctx.getText(`${API}/${encodeURIComponent(slug)}`, {
        ttlSeconds: DAY,
        allowNotFound: true,
      })
      if (!body) {
        scores.set(slug, null)
        ctx.log(`${slug}: not found`)
        continue
      }
      const data = JSON.parse(body) as ScoreResponse
      if (!data.success || typeof data.score !== 'number') {
        scores.set(slug, null)
        ctx.log(`${slug}: no score`)
        continue
      }
      scores.set(slug, data)
      ctx.log(`${slug}: ${data.score}${data.band ? ` · ${data.band}` : ''}`)
    }

    return scores
  },

  async collect({ protocol, prepared }): Promise<FeedResult | null> {
    const slug = table[protocol.id]
    if (!slug) return null

    const scores = prepared as Prepared | undefined
    if (!scores) throw new Error('DeFi Scoring listing unavailable')

    const data = scores.get(slug)
    if (data === undefined) {
      return { note: `DeFi Scoring was not queried for ${slug} this run.` }
    }
    if (data === null) {
      return {
        url: `${SITE}/${slug}`,
        note: `DeFi Scoring publishes no score for ${protocol.name}.`,
      }
    }
    return assess(slug, data)
  },
}

export default adapter
