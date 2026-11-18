import {
  formatUsd,
  type Detail,
  type ExtraFinding,
  type FeedAdapter,
  type FeedResult,
} from '@defi-dna/core'

const DATA = 'https://www.defiscan.info/data'
const SITE = 'https://www.defiscan.info/protocol'
const DAY = 86_400
/** Longest excerpt we quote from DeFiScan’s own protocol description. */
const SUMMARY_CHARS = 700
/** Named admins listed individually on the protocol page, largest by reachable capital. */
const TOP_ADMINS = 5
/** The admin types DeFiScan’s page counts as holding permissioned access. */
const PERMISSIONED = new Set(['EOA', 'EOAPermissioned', 'Multisig', 'Timelock'])
/** Proxy types DeFiScan’s page leaves out when it asks whether every contract is immutable. */
const NOT_CODE = new Set(['gnosis safe', 'EOA'])

interface ReviewTotals {
  contractCount?: number
  permissionedFunctionCount?: number
  scoredFunctionCount?: number
  adminCount?: number
  dependencyCount?: number
  totalCapitalAtRisk?: number
  totalTokenValueAtRisk?: number
  totalTokenValue?: number
  coverage?: number
}

interface ReviewMitigation {
  /** delay | valueRange | relativeValue | other */
  type?: string
  delaySeconds?: number | null
  valueRange?: { min?: number | null; max?: number | null } | null
  relativeValue?: { maxChangePercent?: number | null } | null
  description?: string | null
}

interface ReviewFunction {
  directFundsUsd?: number
  reachableContracts?: { fundsAtRisk?: boolean; fundsUsd?: number }[]
  mitigations?: ReviewMitigation[] | null
}

interface ReviewAdmin {
  name?: string
  description?: string
  adminType?: string
  isGovernance?: boolean
  totalReachableCapital?: number
  totalReachableTokenValue?: number
  functions?: ReviewFunction[]
}

interface ReviewDependency {
  entity?: string | null
  functions?: ReviewFunction[]
}

interface ReviewContract {
  isExternal?: boolean
  proxyType?: string | null
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
  contracts?: ReviewContract[]
  dependencies?: ReviewDependency[]
}

export interface AssessedReview {
  slug: string
  headline: string
  summary?: string
  details: Detail[]
  findings: ExtraFinding[]
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

const usd = (value: number): string => formatUsd(value) ?? `$${value}`
const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`

/** A mitigation delay the way DeFiScan’s page words it: "1 day", "1.5 days", "2 hours", "30 min". */
const spanOf = (seconds: number): string => {
  const unit = (count: number, name: string) =>
    `${Number.isInteger(count) ? count : count.toFixed(1)} ${name}${count !== 1 ? 's' : ''}`
  if (seconds >= DAY) return unit(seconds / DAY, 'day')
  if (seconds >= 3_600) return unit(seconds / 3_600, 'hour')
  if (seconds >= 60)
    return `${Number.isInteger(seconds / 60) ? seconds / 60 : (seconds / 60).toFixed(1)} min`
  return `${seconds}s`
}

const finding = (severity: string, title: string, description: string): ExtraFinding => ({
  title,
  severity,
  category: null,
  description,
})

/**
 * The "Key Findings" DeFiScan’s protocol page derives from a compiled review,
 * under its own rules and in its own words, applied here to the same public
 * JSON. Each rule is one of the page's six; none is ours. A review that lacks
 * the fields a rule reads simply yields no finding from it.
 */
export const findingsOf = (review: CompiledReview): ExtraFinding[] => {
  const admins = review.admins ?? []
  const totals = review.totals ?? {}
  const found: (ExtraFinding | null)[] = []

  // Immutability: no admin with permissioned access at all, else every contract immutable code.
  const ownCode = (review.contracts ?? []).filter(
    (contract) => !contract.isExternal && !NOT_CODE.has(contract.proxyType ?? ''),
  )
  found.push(
    admins.length > 0 &&
      !admins.some((admin) => PERMISSIONED.has(admin.adminType ?? '') || admin.isGovernance)
      ? finding(
          'positive',
          'Fully immutable protocol',
          'All admin controls resolve to immutable contracts or revoked addresses. No admin can modify protocol behavior after deployment.',
        )
      : ownCode.length > 0 && ownCode.every((contract) => contract.proxyType === 'immutable')
        ? finding(
            'info',
            'Immutable code',
            'Every protocol contract is deployed as immutable bytecode. Admins can still write to on-chain parameters exposed by these contracts, but they cannot change the code itself.',
          )
        : null,
  )

  // Keys and multisigs that can reach funds.
  const reachOf = (list: ReviewAdmin[]) =>
    Math.max(0, ...list.map((admin) => admin.totalReachableCapital ?? 0))
  const eoas = admins.filter(
    (admin) => admin.adminType === 'EOA' || admin.adminType === 'EOAPermissioned',
  )
  found.push(
    eoas.length > 0 && reachOf(eoas) > 0
      ? finding(
          'critical',
          `${plural(eoas.length, 'EOA')} with permissioned access`,
          `Externally owned account${eoas.length > 1 ? 's' : ''} can execute critical functions affecting up to ${usd(reachOf(eoas))} in TVL.`,
        )
      : null,
  )
  const multisigs = admins.filter((admin) => admin.adminType === 'Multisig')
  found.push(
    multisigs.length > 0 && reachOf(multisigs) > 0
      ? finding(
          'warning',
          `${plural(multisigs.length, 'multisig')} with permissioned access`,
          `Multisig wallets provide distributed control but still require trust in a known group of signers. ${multisigs.map((admin) => admin.name ?? 'unnamed').join(', ')}.`,
        )
      : null,
  )

  // Total value secured: funds in the contracts plus the protocol token's market cap.
  const tokens = totals.totalTokenValue ?? totals.totalTokenValueAtRisk ?? 0
  const capital = totals.totalCapitalAtRisk ?? 0
  found.push(
    capital + tokens > 0
      ? finding(
          'info',
          `${usd(capital + tokens)} TVS`,
          tokens > 0 && capital > 0
            ? `Total Value Secured by the protocol: ${usd(capital)} in TVL (funds locked in protocol contracts) and ${usd(tokens)} in protocol token market cap.`
            : capital > 0
              ? `Total Value Secured by the protocol, consisting of ${usd(capital)} in TVL (tokens held in contracts).`
              : `Total Value Secured by the protocol, consisting of ${usd(tokens)} in protocol token market cap.`,
        )
      : null,
  )

  // External dependencies, counted by the vendor behind them where DeFiScan names one.
  const dependencies = review.dependencies
  if (dependencies) {
    const vendors = new Set(dependencies.map((dep) => dep.entity).filter(Boolean)).size
    found.push(
      dependencies.length === 0
        ? finding(
            'positive',
            'Fully autonomous protocol',
            'The protocol does not depend on any external contracts, operating entirely through its own on-chain logic.',
          )
        : finding(
            'warning',
            vendors > 0
              ? plural(vendors, 'external vendor')
              : plural(dependencies.length, 'external dependency', 'external dependencies'),
            `The protocol depends on ${plural(dependencies.length, 'external contract')} from ${vendors > 0 ? plural(vendors, 'vendor') : 'external sources'}, introducing third-party risk. A failure or compromise in any dependency could affect protocol operations.`,
          ),
    )
  }

  found.push(mitigationsOf(admins, dependencies ?? []))
  return found.filter((entry) => entry !== null)
}

/** How many of the functions that can reach funds carry a mitigation, and of what kinds. */
const mitigationsOf = (
  admins: ReviewAdmin[],
  dependencies: ReviewDependency[],
): ExtraFinding | null => {
  const all: ReviewMitigation[] = []
  let total = 0
  let mitigated = 0
  for (const admin of admins) {
    for (const fn of admin.functions ?? []) {
      if (fn.mitigations) all.push(...fn.mitigations)
      const reachable = (fn.reachableContracts ?? [])
        .filter((contract) => contract.fundsAtRisk)
        .reduce((sum, contract) => sum + (contract.fundsUsd ?? 0), 0)
      if ((fn.directFundsUsd ?? 0) <= 0 && reachable <= 0) continue
      total++
      if (fn.mitigations && fn.mitigations.length > 0) mitigated++
    }
  }
  for (const dep of dependencies) {
    for (const fn of dep.functions ?? []) if (fn.mitigations) all.push(...fn.mitigations)
  }
  if (all.length === 0 || mitigated === 0) return null

  const seen = new Set<string>()
  const unique = all.filter((entry) => {
    const key = [
      entry.type,
      entry.delaySeconds ?? '',
      entry.valueRange?.min ?? '',
      entry.valueRange?.max ?? '',
      entry.relativeValue?.maxChangePercent ?? '',
      entry.description,
    ].join(':')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const types = new Set(unique.map((entry) => entry.type))
  const kinds: string[] = []
  if (types.has('delay')) {
    const delays = [
      ...new Set(
        unique.flatMap((entry) =>
          entry.type === 'delay' && entry.delaySeconds != null ? [entry.delaySeconds] : [],
        ),
      ),
    ].sort((a, b) => a - b)
    kinds.push(delays.length > 0 ? `time delays (${delays.map(spanOf).join(', ')})` : 'time delays')
  }
  if (types.has('valueRange')) kinds.push('value range limits')
  if (types.has('relativeValue')) kinds.push('relative value caps')
  if (types.has('other')) kinds.push('additional safeguards')
  const list =
    kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds.at(-1)}` : (kinds[0] ?? '')
  return finding(
    'info',
    `${mitigated} out of ${total} functions with potential impact on funds have mitigations`,
    `Taking into account only functions which can impact funds. Mitigations include ${list}.`,
  )
}

/**
 * The headline: the findings DeFiScan’s page flags (critical, warning), by
 * title; the positive ones when nothing is flagged; the published counts when
 * the review carries no finding at all.
 */
export const headlineOf = (
  findings: ExtraFinding[],
  totals: ReviewTotals | undefined,
): string | null => {
  const flagged = findings.filter(
    (entry) => entry.severity === 'critical' || entry.severity === 'warning',
  )
  const shown =
    flagged.length > 0 ? flagged : findings.filter((entry) => entry.severity === 'positive')
  return shown.length > 0 ? shown.map((entry) => entry.title).join(' · ') : countsOf(totals)
}

/** Counts and capital from DeFiScan’s published totals — never a Stage. */
export const countsOf = (totals: ReviewTotals | undefined): string | null => {
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
  const findings = findingsOf(review)
  const headline = headlineOf(findings, review.totals)
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
    findings,
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
  if (primary.findings.length > 0) {
    notes.push(
      'The headline and the findings are the ones DeFiScan’s own page derives from this review, under its rules and in its words.',
    )
  }
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
    ...(primary.findings.length > 0 || reviews.length > 1
      ? {
          extra: {
            ...(primary.findings.length > 0 ? { findings: primary.findings } : {}),
            ...(reviews.length > 1
              ? {
                  text: reviews.map(
                    (review) =>
                      `${review.slug}: ${review.headline}` +
                      (review.updatedAt ? ` (${review.updatedAt})` : '') +
                      ` — ${review.url}`,
                  ),
                }
              : {}),
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
 * scale from the frozen V1 repository. The headline is the page's own "Key
 * Findings" (who holds permissioned access, what the protocol depends on),
 * derived from that JSON by the page's rules; the counts stay in the
 * breakdown. `mapping.json` names the project slug(s) a row takes; DeFiScan
 * files each project separately, so every slug is read and none stands in
 * for the rest.
 */
const adapter: FeedAdapter = {
  id: 'defiscan',

  async collect({ protocol, ctx }): Promise<FeedResult | null> {
    const slugs = ctx.mapping[protocol.id] ?? []
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
