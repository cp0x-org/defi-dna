import { fakeContext } from '@defi-dna/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ratings from './fixtures/ratings.json' with { type: 'json' }
import adapter, { publishedOn, type Rating } from './index.ts'

/*
 * PLACEHOLDER FIXTURE. The API key was not accepted when this adapter was
 * written, so `fixtures/ratings.json` is assembled from Credora's own examples
 * (the API documentation: SwissBorg tBTC, Gauntlet LBTC Core, "testMarket")
 * and the Spark Savings ratings Spark documents on its site as of 2026-06-29
 * (docs.spark.finance, PSL quoted there in percent, written here as the
 * fraction the API publishes; ids, addresses and rating types unknown).
 * Replace it with the trimmed body of the matching .cache/http entry after
 * the first online run, and tighten the expectations to the real values.
 */
const QUERY = 'POST https://api.credora.io/graphql'
const VAULTS = 'https://app.credora.network/vaults'
const mapping = { 'morpho-vaults': ['morpho'], spark: ['spark'], euler: ['euler'] }
const row = (id: string, name = id) => ({ id, name, category: 'yield' })

describe('credora adapter', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads the listing once with the key and counts a row’s Ethereum vaults by name', async () => {
    vi.stubEnv('CREDORA_API_KEY', 'test-key')
    const ctx = fakeContext({ [QUERY]: ratings }, { mapping })
    const prepared = await adapter.prepare!(ctx)
    expect(ctx.requests).toEqual([QUERY])

    const spark = await adapter.collect({ protocol: row('spark', 'Spark'), ctx, prepared })
    expect(spark).toMatchObject({
      value: '6 vaults rated',
      updatedAt: '2026-06-29',
      url: VAULTS,
      note:
        'Counted: 6 Ethereum vault(s) Credora files under "spark" with product "vaults": ' +
        '6 unstated. No vault stands in for the protocol and nothing is averaged — Credora ' +
        'publishes no protocol-level rating. Markets and assets it also rates are not shown.',
    })
    expect(spark?.summary).toBeUndefined()
    // The rating and the PSL exactly as published, one line per vault, by name.
    expect(spark?.details?.map((detail) => [detail.name, detail.value])).toEqual([
      ['Spark Savings ETH', 'A · PSL 0.0039'],
      ['Spark Savings PYUSD', 'A · PSL 0.0015'],
      ['Spark Savings stUSDS', 'B+ · PSL 0.0103'],
      ['Spark Savings USDC', 'A- · PSL 0.0049'],
      ['Spark Savings USDS', 'A- · PSL 0.0052'],
      ['Spark Savings USDT', 'A- · PSL 0.0046'],
    ])
    expect(spark?.details?.[0]?.description).toBe('unstated rating · Published 2026-06-29')
    expect(spark?.extra?.facts).toEqual([
      { name: 'Credora protocol', value: 'spark' },
      { name: 'Vaults rated', value: '6' },
      { name: 'Unstated ratings', value: '6' },
      {
        name: 'PSL (the Score column)',
        value:
          'Probability of Significant Loss — annualized probability of a 1% loss on market supply',
      },
    ])
    expect(spark?.extra?.vaults).toHaveLength(6)
    expect(spark?.extra?.vaults?.[2]).toEqual({
      name: 'Spark Savings stUSDS',
      version: null,
      curator: null,
      tier: 'B+',
      score: 0.0103,
      tvlUsd: null,
      scoredAt: '2026-06-29',
      url: `${VAULTS}#Spark%20Savings%20stUSDS`,
    })
    // No further request per protocol.
    expect(ctx.requests).toEqual([QUERY])
  })

  it('keeps only Ethereum vaults — no Base vault, no market — and drops a malformed date', async () => {
    vi.stubEnv('CREDORA_API_KEY', 'test-key')
    const ctx = fakeContext({ [QUERY]: ratings }, { mapping })
    const prepared = await adapter.prepare!(ctx)
    const morpho = await adapter.collect({ protocol: row('morpho-vaults'), ctx, prepared })
    expect(morpho?.value).toBe('1 vault rated')
    expect(morpho?.updatedAt).toBeUndefined()
    expect(morpho?.details).toEqual([
      {
        name: 'SwissBorg tBTC',
        value: 'A+ · PSL 0.0011200000000000001',
        description: 'Curated by Gauntlet · unstated rating',
      },
    ])
    expect(morpho?.extra?.vaults).toEqual([
      {
        name: 'SwissBorg tBTC',
        version: null,
        curator: 'Gauntlet',
        tier: 'A+',
        score: 0.0011200000000000001,
        tvlUsd: null,
        scoredAt: null,
        url: `${VAULTS}#0x059Fc6723b9bF77DbF4283C8d7C90eA8Af44EF10`,
      },
    ])
  })

  it('reports a mapped protocol without vaults as a note, and an unmapped one as null', async () => {
    vi.stubEnv('CREDORA_API_KEY', 'test-key')
    const ctx = fakeContext({ [QUERY]: ratings }, { mapping })
    const prepared = await adapter.prepare!(ctx)
    const euler = await adapter.collect({ protocol: row('euler', 'Euler'), ctx, prepared })
    expect(euler?.value).toBeUndefined()
    expect(euler).toMatchObject({
      url: VAULTS,
      note:
        'Credora publishes no Ethereum vault rating under "euler". ' +
        'Markets and assets it also rates are not shown here.',
    })
    await expect(adapter.collect({ protocol: row('lido'), ctx, prepared })).resolves.toBeNull()
  })

  it('refuses to query without the key and surfaces a GraphQL error', async () => {
    await expect(adapter.prepare!(fakeContext({ [QUERY]: ratings }, { mapping }))).rejects.toThrow(
      'CREDORA_API_KEY is not set',
    )
    vi.stubEnv('CREDORA_API_KEY', 'test-key')
    const refused = fakeContext(
      { [QUERY]: { errors: [{ message: 'Unauthorized: Invalid or missing API key' }] } },
      { mapping },
    )
    await expect(adapter.prepare!(refused)).rejects.toThrow('Credora: Unauthorized')
    expect(adapter.secrets).toEqual(['CREDORA_API_KEY'])
  })

  it('accepts only a real calendar date as the feed’s date', () => {
    const dated = (publishDate: string | null): Rating =>
      ({ Metrics: { rating: 'A', psl: null, publishDate } }) as Rating
    expect(publishedOn(dated('2025-11-30'))).toBe('2025-11-30')
    expect(publishedOn(dated('2025-19-09'))).toBeNull()
    expect(publishedOn(dated('2025-09-19T00:00:00Z'))).toBeNull()
    expect(publishedOn(dated(null))).toBeNull()
  })
})
