import type { MetricAdapter, MetricResult } from '@defi-dna/core'
import mapping from '../tvl/mapping.json' with { type: 'json' }

const HACKS = 'https://api.llama.fi/hacks'
const DAY = 86_400

/** The same protocol ids as TVL: DefiLlama files both under one numeric id. */
const table: Record<string, string | string[]> = mapping
const llamaIds = (id: string): string[] => {
  const value = table[id]
  return value == null ? [] : typeof value === 'string' ? [value] : value
}

interface Hack {
  date: number
  name: string
  classification: string
  technique: string
  amount: number
  defillamaId: string | null
  returnedFunds: number | null
  source?: string
}

/**
 * Incident history, as recorded by DefiLlama.
 *
 * Matched on DefiLlama's numeric protocol id only. Attributing an incident to a
 * protocol is their editorial call; guessing at it by name would make it ours.
 */
const adapter: MetricAdapter = {
  id: 'incidents',

  async prepare(ctx): Promise<Map<string, Hack[]>> {
    const hacks = await ctx.getJson<Hack[]>(HACKS, { ttlSeconds: DAY })
    const byId = new Map<string, Hack[]>()
    for (const hack of hacks) {
      if (!hack.defillamaId) continue
      const id = String(hack.defillamaId)
      byId.set(id, [...(byId.get(id) ?? []), hack])
    }
    ctx.log(`${hacks.length} incidents across ${byId.size} protocols`)
    return byId
  },

  async collect({ protocol, prepared }): Promise<MetricResult | null> {
    const ids = llamaIds(protocol.id)
    if (ids.length === 0) return null
    const listed = prepared as Map<string, Hack[]> | undefined
    if (!listed) throw new Error('DefiLlama incident list unavailable')

    const events = ids.flatMap((id) => listed.get(id) ?? []).sort((a, b) => b.date - a.date)

    return {
      value: events.length,
      url: 'https://defillama.com/hacks',
      note: 'Absence from DefiLlama’s registry is not proof that nothing happened.',
      extra: {
        incidents: events.map((event) => ({
          date: new Date(event.date * 1000).toISOString().slice(0, 10),
          name: event.name,
          amountUsd: event.amount,
          classification: event.classification,
          technique: event.technique,
          returnedFunds: event.returnedFunds,
          source: event.source || null,
        })),
      },
    }
  },
}

export default adapter
