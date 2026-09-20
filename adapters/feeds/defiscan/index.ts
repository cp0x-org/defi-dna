import type { Detail, FeedAdapter, FeedResult } from '@defi-dna/core'
import mapping from './mapping.json' with { type: 'json' }

const RAW = 'https://raw.githubusercontent.com/deficollective/defiscan/main/src/content/protocols'
const SITE = 'https://www.defiscan.info/protocols'
/** Front matter plus the opening Summary paragraph; the reviews themselves are huge. */
const HEAD_BYTES = 24_000
const DAY = 86_400

/** The five risk slots DeFiScan files in every review, in the order it publishes them. */
const RISKS = ['Chain', 'Upgradeability', 'Autonomy', 'Exit Window', 'Accessibility']

/** Codes DeFiScan uses outside the numbered stages. */
const STAGES: Record<string, string> = {
  R: 'Under review',
  O: 'Unqualified',
  V: 'Variable',
  I0: 'Infrastructure Stage 0',
  I1: 'Infrastructure Stage 1',
  I2: 'Infrastructure Stage 2',
}

/** our protocol id -> the review file(s) DeFiScan publishes for it */
const table: Record<string, string | string[]> = mapping

export interface Review {
  stage?: string
  risks: string[]
  date?: string
  summary?: string
}

/** Read stage, risk levels and date out of a review's YAML front matter. */
export function parseReview(text: string): Review {
  const scalar = (key: string) =>
    new RegExp(`^${key}:\\s*"?([^"\\n\\[]+?)"?\\s*$`, 'm').exec(text)?.[1]?.trim() || undefined
  const list = (key: string) =>
    (new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, 'm').exec(text)?.[1] ?? '')
      .split(',')
      .map((value) => value.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)

  // Reviews are fetched as a truncated head, so every field is read on its own:
  // a cut-off tail costs us the summary, never the stage.
  const date = [scalar('update_date'), scalar('publish_date')].find(
    (value) => value && !value.startsWith('1970-'),
  )
  const summary = summaryOf(text)
  return {
    stage: scalar('stage'),
    risks: list('risks'),
    ...(date ? { date } : {}),
    ...(summary ? { summary } : {}),
  }
}

/** First paragraph under `# Summary`, quoted as the feed's own description. */
function summaryOf(text: string): string | undefined {
  const start = text.search(/^#\s+Summary\s*$/m)
  if (start === -1) return undefined
  const paragraph = text
    .slice(start)
    .split('\n')
    .slice(1)
    .join('\n')
    .trim()
    .split(/\n\s*\n/)[0]
  const flat = paragraph?.replace(/\s+/g, ' ').trim()
  return flat && !flat.startsWith('#') ? flat.slice(0, 700) : undefined
}

const stageLabel = (stage: string): string => STAGES[stage] ?? `Stage ${stage}`

/**
 * DeFiScan — decentralization maturity reviews.
 *
 * Read from the project's own public repository, which is what their site is
 * built from. DeFiScan reviews one deployment at a time, so a protocol can map
 * to several review files; all of them are read and the cell shows every stage
 * they publish, joined, rather than picking one to speak for the rest.
 */
const adapter: FeedAdapter = {
  id: 'defiscan',

  async collect({ protocol, ctx }): Promise<FeedResult | null> {
    const entry = table[protocol.id]
    if (!entry) return null
    const files = typeof entry === 'string' ? [entry] : entry

    const fetched = await Promise.all(
      files.map(async (file) => {
        const head = await ctx.getText(`${RAW}/${file}`, {
          rangeBytes: [0, HEAD_BYTES],
          ttlSeconds: DAY,
          allowNotFound: true,
        })
        const review = head ? parseReview(head) : null
        return review?.stage ? { file, ...review } : null
      }),
    )
    const reviews = fetched.filter((review) => review !== null)
    const primary = reviews[0]
    if (!primary) {
      return { note: `DeFiScan publishes no review we could read for ${protocol.name}.` }
    }

    const stages = [...new Set(reviews.map((review) => stageLabel(review.stage as string)))]
    const details: Detail[] = RISKS.map((name, i) => ({
      name,
      value: primary.risks[i] ?? '-',
    }))

    return {
      value: stages.join(' · '),
      ...(primary.summary ? { summary: primary.summary } : {}),
      details,
      ...(primary.date ? { updatedAt: primary.date } : {}),
      url: `${SITE}/${primary.file.replace(/\.md$/, '')}`,
      ...(reviews.length > 1
        ? {
            note: `DeFiScan reviews each deployment separately. This cell reads ${reviews.length} reviews: ${files.join(', ')}.`,
          }
        : {}),
      extra: {
        reviews: reviews.map((review) => ({
          file: review.file,
          stage: stageLabel(review.stage as string),
          risks: review.risks,
          date: review.date ?? null,
          url: `${SITE}/${review.file.replace(/\.md$/, '')}`,
        })),
      },
    }
  },
}

export default adapter
