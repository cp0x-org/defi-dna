import type { Detail, FeedAdapter, FeedResult } from '@defi-dna/core'

const API = 'https://example.com/api'

/** What the feed's own endpoint returns. Replace with its real shape. */
interface Assessment {
  rating: string
  text?: string
  dimensions?: { name: string; value: string; why?: string }[]
  updated?: string
}

/**
 * `mapping.json` next to this file maps our protocol ids to the feed's own
 * ids. The pipeline reads it, checks every key against the registry and hands
 * it in as `ctx.mapping`, with every value as a list. A protocol the feed does
 * not cover is simply absent: collect() returns null, the cell stays grey and
 * nothing breaks.
 *
 * The type parameter is whatever prepare() returns; collect() receives it typed.
 */
const adapter: FeedAdapter<Set<string>> = {
  id: '_template',

  // Environment variables the feed needs, if any. A missing one skips the feed
  // for the run and reports it once; `--offline` reads need none.
  // secrets: ['EXAMPLE_API_KEY'],

  /**
   * Optional. Runs once per run; whatever it returns is handed to every
   * collect() call as `prepared`. Use it to pull one listing instead of one
   * request per protocol. If it throws, the column keeps the previous values.
   */
  async prepare(ctx): Promise<Set<string>> {
    const listed = await ctx.getJson<{ id: string }[]>(`${API}/protocols`, { ttlSeconds: 21_600 })
    ctx.log(`${listed.length} protocols listed`)
    return new Set(listed.map((entry) => entry.id))
  },

  async collect({ protocol, ctx, prepared }): Promise<FeedResult | null> {
    const [id] = ctx.mapping[protocol.id] ?? []
    if (!id) return null // the feed has nothing for this protocol

    // Optional: a listed-but-empty protocol is still "no data", not an error.
    if (!prepared.has(id)) {
      return { note: `The feed lists no assessment for ${protocol.name}.` }
    }

    // Throwing means "we could not read the source" — never "not covered".
    const assessment = await ctx.getJson<Assessment>(`${API}/protocols/${id}`, {
      ttlSeconds: 21_600,
    })

    const details: Detail[] = (assessment.dimensions ?? []).map((dimension) => ({
      name: dimension.name,
      value: dimension.value,
      // Shown behind a dropdown on the protocol page.
      ...(dimension.why ? { description: dimension.why } : {}),
    }))

    return {
      // Verbatim, exactly as the feed publishes it. No conversion, no rounding.
      value: assessment.rating,
      ...(assessment.text ? { summary: assessment.text } : {}),
      details,
      // The feed's own date, not the time we fetched it.
      ...(assessment.updated ? { updatedAt: assessment.updated } : {}),
      // Where a reader can check the value.
      url: `https://example.com/protocol/${id}`,
    }
  },
}

export default adapter
