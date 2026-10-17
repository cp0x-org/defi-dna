import type { Detail, FeedAdapter, FeedResult } from '@defi-dna/core'

/** The extension API DeFiPunk’d pointed us to in writing (October 2026). */
const API = 'https://defipunkd.com/api/extension'
const SITE = 'https://defipunkd.com/protocol'
/** The JSON is rebuilt with the site; twice a day is more often than grades move. */
const TTL = 12 * 3600
/** Longest excerpt we quote from DeFiPunk’d’s own `about`. */
const SUMMARY_CHARS = 700
/**
 * The tier legend DeFiPunk’d prints on its landing table, word for word, and
 * its methodology's line for a protocol without a medal.
 */
const TIERS: Record<string, string> = {
  gold: 'Strong AI consensus on all dimensions',
  silver: 'Weak AI consensus on all dimensions',
  bronze: 'AI consensus on at least one dimension',
  wood: 'At least one model submission, no quorum yet',
  none: 'Fewer than three models have agreed on any slice yet',
}

export interface Slice {
  id: string
  label: string
  /** green | orange | red | gray */
  grade: string
  /** A quorum was reached, on a consensus DeFiPunk’d flags as weak. */
  tentative: boolean
  /** No quorum yet: the grade is the most severe one submitted so far. */
  partial: boolean
}

export interface IndexEntry {
  name: string
  category: string
  tier: string
  slices: Slice[]
}

export interface ProtocolEntry extends IndexEntry {
  about: string | null
  pills: {
    upgradeability: string | null
    bugBountyUrl: string | null
    governanceForum: string | null
    docsUrl: string | null
  }
  slices: (Slice & {
    modelsCount: number
    shortHeadline: string | null
    verdict: string | null
  })[]
}

interface IndexFile {
  protocols: Record<string, IndexEntry>
}

const trim = (text: string | null | undefined): string | undefined => {
  const flat = text?.replace(/\s+/g, ' ').trim()
  if (!flat) return undefined
  return flat.length > SUMMARY_CHARS ? `${flat.slice(0, SUMMARY_CHARS - 1).trimEnd()}…` : flat
}

/**
 * A slice's state in DeFiPunk’d’s own words, as its extension titles a wedge:
 * gray reads "unknown", a weak consensus "tentative orange", a slice without
 * quorum "tentative orange (2/3 models submitted)".
 */
export const stateOf = (slice: Slice & { modelsCount?: number }): string => {
  const grade = slice.grade === 'gray' ? 'unknown' : slice.grade
  if (slice.partial) {
    return slice.modelsCount == null
      ? `tentative ${grade}`
      : `tentative ${grade} (${slice.modelsCount}/3 models submitted)`
  }
  return slice.tentative ? `tentative ${grade}` : grade
}

/** `Control: tentative orange · Ability to exit: tentative red · …` — all five, in DeFiPunk’d’s order. */
export const headlineOf = (slices: Slice[], separator = ' · '): string =>
  slices.map((slice) => `${slice.label}: ${stateOf(slice)}`).join(separator)

const detailsOf = (entry: ProtocolEntry, prefix: string): Detail[] =>
  entry.slices.map((slice) => {
    const description = [
      slice.shortHeadline,
      // A partial slice already says "(n/3 models submitted)" in its value.
      !slice.partial && slice.modelsCount > 0
        ? `Assessed by ${slice.modelsCount} model${slice.modelsCount === 1 ? '' : 's'}`
        : null,
      slice.verdict?.replace(/\s+/g, ' ').trim(),
    ]
      .filter(Boolean)
      .join(' — ')
    return {
      name: `${prefix}${slice.label}`,
      value: stateOf(slice),
      ...(description ? { description } : {}),
    }
  })

const factsOf = (entry: ProtocolEntry, suffix: string): Detail[] =>
  (
    [
      {
        name: `Tier${suffix}`,
        value: TIERS[entry.tier] ? `${entry.tier} · ${TIERS[entry.tier]}` : entry.tier,
      },
      { name: `Category${suffix}`, value: entry.category },
      { name: `Upgradeability${suffix}`, value: entry.pills.upgradeability },
      { name: `Bug bounty${suffix}`, value: entry.pills.bugBountyUrl },
      { name: `Governance forum${suffix}`, value: entry.pills.governanceForum },
      { name: `Docs${suffix}`, value: entry.pills.docsUrl },
    ] as { name: string; value: string | null }[]
  ).flatMap(({ name, value }) => (value ? [{ name, value }] : []))

/**
 * DeFiPunk’d — five risk slices per deployment, graded by a quorum of LLM runs.
 *
 * DeFiPunk’d grades each DeFiLlama deployment on Control, Ability to exit,
 * Autonomy, Open Access and Verifiability (green, orange, red; gray where no
 * grade has been earned). It publishes no grade for the protocol as a whole:
 * the headline is the five slices, verbatim, and nothing is combined into one.
 * Its tier (wood … gold) measures how far the grades have been reviewed, and
 * DeFiPunk’d says plainly it is not a safety signal, so it goes into the facts,
 * never the headline. Grades cover the deployment on every chain it runs on.
 *
 * One index read per run; one detail read per mapped slug for the headlines,
 * verdicts and model counts the index leaves out.
 */
const adapter: FeedAdapter<Map<string, IndexEntry>> = {
  id: 'defipunkd',

  async prepare(ctx): Promise<Map<string, IndexEntry>> {
    const index = await ctx.getJson<IndexFile>(`${API}/index.json`, { ttlSeconds: TTL })
    if (!index.protocols || typeof index.protocols !== 'object') {
      throw new Error('DeFiPunk’d index.json has no `protocols` object')
    }
    const listed = new Map(Object.entries(index.protocols))
    ctx.log(`${listed.size} slugs listed`)
    // A renamed slug would otherwise look like a coverage gap.
    const missing = Object.values(ctx.mapping)
      .flat()
      .filter((slug) => !listed.has(slug))
    if (missing.length > 0) ctx.log(`mapped but not listed: ${missing.join(', ')}`)
    return listed
  },

  async collect({ protocol, ctx, prepared }): Promise<FeedResult | null> {
    const slugs = ctx.mapping[protocol.id] ?? []
    if (slugs.length === 0) return null

    const listed = slugs.filter((slug) => prepared.has(slug))
    if (listed.length === 0) {
      return {
        url: `${SITE}/${slugs[0]}`,
        note: `DeFiPunk’d lists no assessment under ${slugs.map((slug) => `"${slug}"`).join(', ')}.`,
      }
    }

    const entries = await Promise.all(
      listed.map(async (slug) => ({
        slug,
        entry: await ctx.getJson<ProtocolEntry>(
          `${API}/protocol/${encodeURIComponent(slug)}.json`,
          {
            ttlSeconds: TTL,
          },
        ),
      })),
    )
    for (const { slug, entry } of entries) {
      if (!Array.isArray(entry.slices) || entry.slices.length === 0) {
        throw new Error(`DeFiPunk’d ${slug}.json has no slices`)
      }
    }

    const several = entries.length > 1
    const value = several
      ? entries.map(({ entry }) => `${entry.name} — ${headlineOf(entry.slices, ', ')}`).join(' · ')
      : headlineOf(entries[0]!.entry.slices)
    const summary = trim(entries.find(({ entry }) => entry.about)?.entry.about)
    const filed = entries.map(({ slug, entry }) => `${entry.name} ("${slug}")`).join(' and ')
    const unlisted = slugs.filter((slug) => !prepared.has(slug))

    return {
      value,
      ...(summary ? { summary } : {}),
      details: entries.flatMap(({ entry }) => detailsOf(entry, several ? `${entry.name} · ` : '')),
      url: `${SITE}/${entries[0]!.slug}`,
      note:
        `DeFiPunk’d files ${protocol.name} as ${filed}` +
        (several ? '; each is graded separately and every one is shown. ' : '. ') +
        'Grades cover the deployment on every chain it runs on, not Ethereum mainnet alone, ' +
        'and DeFiPunk’d publishes no date with them.' +
        (unlisted.length > 0 ? ` Not listed by DeFiPunk’d: ${unlisted.join(', ')}.` : ''),
      extra: {
        facts: entries.flatMap(({ entry }) => factsOf(entry, several ? ` (${entry.name})` : '')),
        ...(several
          ? { text: entries.map(({ slug, entry }) => `${entry.name}: ${SITE}/${slug}`) }
          : {}),
      },
    }
  },
}

export default adapter
