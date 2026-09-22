import type { Detail, FeedAdapter, FeedResult } from '@defi-dna/core'
import mapping from './mapping.json' with { type: 'json' }

const API = 'https://example.com/api'

/**
 * our protocol id -> the feed's own id.
 *
 * A protocol the feed does not cover is simply absent: collect() returns null,
 * the cell stays grey and nothing breaks. Use a list when the feed files
 * several things under one of our rows.
 */
const table: Record<string, string | string[]> = mapping
const ids = (id: string): string[] => {
  const value = table[id]
  return value == null ? [] : typeof value === 'string' ? [value] : value
}

/** What the feed's own endpoint returns. Replace with its real shape. */
interface Assessment {
  rating: string
  text?: string
  dimensions?: { name: string; value: string; why?: string }[]
  updated?: string
}

const adapter: FeedAdapter = {
  id: '_template',

  /**
   * Optional. Runs once per run; whatever it returns is handed to every
   * collect() call as `prepared`. Use it to pull one listing instead of one
   * request per protocol.
   */
  async prepare(ctx): Promise<Set<string>> {
    const listed = await ctx.getJson<{ id: string }[]>(`${API}/protocols`, { ttlSeconds: 21_600 })
    ctx.log(`${listed.length} protocols listed`)
    return new Set(listed.map((entry) => entry.id))
  },

  async collect({ protocol, ctx, prepared }): Promise<FeedResult | null> {
    const [id] = ids(protocol.id)
    if (!id) return null // the feed has nothing for this protocol

    // Optional: a listed-but-empty protocol is still "no data", not an error.
    if (!(prepared as Set<string> | undefined)?.has(id)) {
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
