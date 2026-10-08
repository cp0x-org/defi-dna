import { formatUsd, type Detail, type FeedAdapter, type FeedResult } from '@defi-dna/core'
import mapping from './mapping.json' with { type: 'json' }

const DATA = 'https://www.defiscan.info/data'
const SITE = 'https://www.defiscan.info/protocol'
const DAY = 86_400
/** Longest excerpt we quote from DeFiScan’s own protocol description. */
const SUMMARY_CHARS = 700
/** Named admins listed individually on the protocol page, largest by reachable capital. */
const TOP_ADMINS = 5

/** our protocol id -> the project slug(s) DeFiScan publishes under */
const table: Record<string, string | string[]> = mapping

const entries = (id: string): string[] => {
  const value = table[id]
  return value == null ? [] : typeof value === 'string' ? [value] : value
}

interface ReviewTotals {
  contractCount?: number
  permissionedFunctionCount?: number
  scoredFunctionCount?: number
  adminCount?: number
  dependencyCount?: number
  totalCapitalAtRisk?: number
  totalTokenValueAtRisk?: number
  coverage?: number
}

interface ReviewAdmin {
  name?: string
  description?: string
  adminType?: string
  isGovernance?: boolean
  totalReachableCapital?: number
  totalReachableTokenValue?: number
}

interface CompiledReview {
  project?: string
  publishedAt?: string
  lastModified?: string
  compiledAt?: string
  verified?: boolean
  metadata?: {
    protocolName?: string
    protocolSlug?: string
    chain?: string
    projectType?: string
    description?: string
  }
  totals?: ReviewTotals
  admins?: ReviewAdmin[]
}

export interface AssessedReview {
  slug: string
  headline: string
  summary?: string
  details: Detail[]
  updatedAt?: string
  url: string
  chain?: string
  compiledAt?: string
}

const trim = (text: string | undefined, max = SUMMARY_CHARS): string | undefined => {
  const flat = text?.replace(/\s+/g, ' ').trim()
  if (!flat) return undefined
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

const count = (value: number | undefined): string | null =>
  value != null && Number.isFinite(value) ? String(value) : null

/** Headline from DeFiScan’s published totals — counts and capital, not a Stage. */
export const headlineOf = (totals: ReviewTotals | undefined): string | null => {
  if (!totals) return null
  const admins = count(totals.adminCount)
  const capital =
    totals.totalCapitalAtRisk != null &&
    Number.isFinite(totals.totalCapitalAtRisk) &&
    totals.totalCapitalAtRisk > 0
      ? formatUsd(totals.totalCapitalAtRisk)
      : null
  const contracts = count(totals.contractCount)
  const parts = [
    admins ? `${admins} admins` : null,
    capital ? `${capital} capital at risk` : null,
    !capital && contracts ? `${contracts} contracts` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

const dateOf = (review: CompiledReview): string | undefined => {
  const raw = [review.lastModified, review.publishedAt].find(Boolean)
  return raw ? raw.slice(0, 10) : undefined
}

/** Turn one compiled-review.json into the fields we store for a protocol cell. */
export const assessReview = (slug: string, review: CompiledReview): AssessedReview | null => {
  const headline = headlineOf(review.totals)
  if (!headline) return null

  const totals = review.totals ?? {}
  const details: Detail[] = (
    [
      { name: 'Admins', value: count(totals.adminCount) },
      { name: 'Contracts', value: count(totals.contractCount) },
      {
        name: 'Permissioned functions',
        value: count(totals.permissionedFunctionCount),
      },
      {
        name: 'Capital at risk',
        value: formatUsd(totals.totalCapitalAtRisk),
      },
      {
        name: 'Token value at risk',
        value: formatUsd(totals.totalTokenValueAtRisk),
      },
      { name: 'Dependencies', value: count(totals.dependencyCount) },
      {
        name: 'Verified coverage',
        value:
          totals.coverage != null && Number.isFinite(totals.coverage)
            ? `${totals.coverage}%`
            : null,
      },
    ] as { name: string; value: string | null }[]
  ).flatMap(({ name, value }) => (value ? [{ name, value }] : []))

  const admins = [...(review.admins ?? [])]
    .filter((admin) => admin.name)
    .sort((a, b) => (b.totalReachableCapital ?? 0) - (a.totalReachableCapital ?? 0))
    .slice(0, TOP_ADMINS)

  for (const admin of admins) {
    const reachable =
      formatUsd(admin.totalReachableCapital) ?? formatUsd(admin.totalReachableTokenValue)
    const roles = [admin.isGovernance ? 'governance' : null, admin.adminType].filter(Boolean)
    details.push({
      name: admin.name as string,
      value: reachable ? `${reachable} reachable` : roles.join(' · ') || 'admin',
      description: [roles.length > 0 ? roles.join(' · ') : null, trim(admin.description, 400)]
        .filter(Boolean)
        .join(' — '),
    })
  }

  const updatedAt = dateOf(review)
  const compiledAt = review.compiledAt?.slice(0, 10)
  return {
    slug,
    headline,
    ...(trim(review.metadata?.description) ? { summary: trim(review.metadata?.description) } : {}),
    details,
    ...(updatedAt ? { updatedAt } : {}),
    url: `${SITE}/${slug}`,
    ...(review.metadata?.chain ? { chain: review.metadata.chain } : {}),
    ...(compiledAt ? { compiledAt } : {}),
  }
}

/** Merge one or more DeFiScan project reviews into a single FeedResult. */
export const assess = (reviews: AssessedReview[]): FeedResult => {
  const primary = reviews[0]
  if (!primary) {
    return { note: 'DeFiScan published no compiled review we could read for this mapping.' }
  }

  const headlines = [...new Set(reviews.map((review) => review.headline))]
  const updatedAt = reviews
    .map((review) => review.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1)

  const notes: string[] = []
  if (primary.chain) notes.push(`Review covers ${primary.chain}.`)
  if (primary.compiledAt && primary.updatedAt && primary.compiledAt !== primary.updatedAt) {
    notes.push(
      `DeFiScan’s review date is ${primary.updatedAt}; the compiled JSON was rebuilt on ${primary.compiledAt}.`,
    )
  }
  if (reviews.length > 1) {
    notes.push(
      `DeFiScan files each project separately. This cell reads ${reviews.length} reviews: ${reviews.map((review) => review.slug).join(', ')}.`,
    )
  }

  return {
    value: headlines.join(' · '),
    ...(primary.summary ? { summary: primary.summary } : {}),
    details: primary.details,
    ...(updatedAt ? { updatedAt } : {}),
    url: primary.url,
    ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
    ...(reviews.length > 1
      ? {
          extra: {
            text: reviews.map(
              (review) =>
                `${review.slug}: ${review.headline}` +
                (review.updatedAt ? ` (${review.updatedAt})` : '') +
                ` — ${review.url}`,
            ),
          },
        }
      : {}),
  }
}

/**
 * DeFiScan — on-chain admin-rights and dependency reviews (V2).
 *
 * Reads the public compiled-review JSON the site serves. V2 publishes counts,
 * capital at risk, admins and permissioned functions — not the Stage 0/1/2
 * scale from the frozen V1 repository.
 */
const adapter: FeedAdapter = {
  id: 'defiscan',

  async collect({ protocol, ctx }): Promise<FeedResult | null> {
    const slugs = entries(protocol.id)
    if (slugs.length === 0) return null

    const fetched = await Promise.all(
      slugs.map(async (slug) => {
        // allowNotFound returns an empty body; parse only when the file exists.
        const body = await ctx.getText(`${DATA}/${encodeURIComponent(slug)}/compiled-review.json`, {
          ttlSeconds: DAY,
          allowNotFound: true,
        })
        if (!body) {
          ctx.log(`${slug}: not found`)
          return null
        }
        const review = JSON.parse(body) as CompiledReview
        const assessed = assessReview(slug, review)
        if (!assessed) {
          ctx.log(`${slug}: no published totals`)
          return null
        }
        ctx.log(`${slug}: ${assessed.headline}`)
        return assessed
      }),
    )
    const reviews = fetched.filter((review) => review !== null)
    if (reviews.length === 0) {
      return {
        note: `DeFiScan publishes no compiled review we could read for ${protocol.name}.`,
      }
    }
    return assess(reviews)
  },
}

export default adapter
