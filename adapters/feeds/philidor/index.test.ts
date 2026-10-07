import { fakeContext } from '@defi-dna/core/testing'
import { describe, expect, it } from 'vitest'
import morpho from './fixtures/vaults-morpho.json' with { type: 'json' }
import spark from './fixtures/vaults-spark.json' with { type: 'json' }
import adapter from './index.ts'

const page = (protocol: string) =>
  `https://api.philidor.io/v1/vaults?protocol=${protocol}&chain=Ethereum&limit=100&page=1&sortBy=tvl_usd&sortOrder=desc`

const mapping = { 'morpho-vaults': ['morpho:v1', 'morpho:v2'], spark: ['spark'] }

describe('philidor', () => {
  it('lists vaults once per run, then counts only the versions a row maps to', async () => {
    const ctx = fakeContext({ [page('morpho')]: morpho, [page('spark')]: spark }, { mapping })
    const prepared = await adapter.prepare!(ctx)
    expect(ctx.requests).toEqual([page('morpho'), page('spark')])

    const result = await adapter.collect({
      protocol: { id: 'morpho-vaults', name: 'Morpho Vaults', category: 'yield' },
      ctx,
      prepared,
    })
    expect(result).toMatchObject({
      value: '3 vaults rated',
      updatedAt: '2026-10-01',
      url: 'https://analytics.philidor.io/protocols/morpho',
    })
    // Largest by TVL first, verdict as published.
    expect(result?.details?.map((detail) => [detail.name, detail.value])).toEqual([
      ['Sentora RLUSD Main', 'Core 7.80'],
      ['Steakhouse USDT', 'Prime 8.84'],
      ['Steakhouse USDC', 'Core 7.90'],
    ])
    expect(result?.extra?.facts).toContainEqual({ name: 'Versions', value: 'v1, v2' })
    expect(result?.extra?.vaults?.[0]).toMatchObject({
      name: 'Sentora RLUSD Main',
      version: 'v2',
      curator: 'Sentora',
      tier: 'Core',
      tvlUsd: 421154651,
    })
    expect(ctx.requests).toHaveLength(2) // the per-protocol pass touches no network
  })

  it('leaves shut-down vaults out of the count and says so', async () => {
    const ctx = fakeContext({ [page('morpho')]: morpho, [page('spark')]: spark }, { mapping })
    const prepared = await adapter.prepare!(ctx)
    const result = await adapter.collect({
      protocol: { id: 'spark', name: 'Spark', category: 'lending' },
      ctx,
      prepared,
    })
    expect(result?.value).toBe('1 vaults rated')
    expect(result?.note).toContain('1 shut-down vault(s) left out')
    expect(result?.extra?.facts).toContainEqual({ name: 'Vaults shut down', value: '1' })
  })
})
