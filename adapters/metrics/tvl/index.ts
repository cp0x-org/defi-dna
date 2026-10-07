import type { MetricAdapter, MetricResult } from '@defi-dna/core'

const LIST = 'https://api.llama.fi/lite/protocols2'

interface Entry {
  name: string
  defillamaId: string
  chainTvls?: Record<string, { tvl?: number }>
}

/** DefiLlama's own link for a protocol is its name, lowercased and hyphenated. */
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * Ethereum-mainnet TVL, from DefiLlama.
 *
 * A measured quantity, not a verdict: it is shown next to the assessments and
 * never combined with them. A protocol usually has several deployments, so the
 * figure is the sum of exactly the DefiLlama numeric ids `mapping.json` names,
 * and the breakdown travels with it so the sum stays checkable.
 */
const adapter: MetricAdapter<Map<string, Entry>> = {
  id: 'tvl',

  async prepare(ctx): Promise<Map<string, Entry>> {
    const payload = await ctx.getJson<{ protocols?: Entry[] }>(LIST, { ttlSeconds: 900 })
    const byId = new Map(
      (payload.protocols ?? []).map((entry) => [String(entry.defillamaId), entry]),
    )
    ctx.log(`${byId.size} protocols listed`)
    return byId
  },

  async collect({ protocol, ctx, prepared: listed }): Promise<MetricResult | null> {
    const ids = ctx.mapping[protocol.id] ?? []
    if (ids.length === 0) return null

    const components = ids.flatMap((id) => {
      const entry = listed.get(id)
      return entry
        ? [{ id, name: entry.name, tvl: entry.chainTvls?.['Ethereum']?.tvl ?? null }]
        : []
    })
    const measured = components.filter((component) => component.tvl != null)
    const first = components[0]

    return {
      value: measured.length
        ? measured.reduce((sum, component) => sum + (component.tvl as number), 0)
        : null,
      ...(first ? { url: `https://defillama.com/protocol/${slug(first.name)}` } : {}),
      ...(measured.length === 0
        ? { note: `DefiLlama publishes no Ethereum TVL for ${protocol.name}.` }
        : {}),
      extra: { components },
    }
  },
}

export default adapter
