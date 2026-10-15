import { fakeContext } from '@defi-dna/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ratings from './fixtures/ratings.json' with { type: 'json' }
import adapter, { publishedOn, type Rating } from './index.ts'

/*
 * `fixtures/ratings.json` is the body of the adapter's own query (Ethereum,
 * filtered server-side) as Credora answered it on 2026-10-15, trimmed to two
 * vaults of each product it files vaults under (`vault`, `vaults_v2`,
 * `savings`), one market and one asset.
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

    const morpho = await adapter.collect({ protocol: row('morpho-vaults'), ctx, prepared })
    expect(morpho).toMatchObject({
      value: '4 vaults rated',
      updatedAt: '2026-10-15',
      url: VAULTS,
      note:
        'Counted: 4 Ethereum vault(s) Credora files under "morpho", product "vault" (2), ' +
        '"vaults_v2" (2); rating type indicative (4). No vault stands in for the protocol and ' +
        'nothing is averaged — Credora publishes no protocol-level rating. Markets and assets ' +
        'it also rates are not shown.',
    })
    expect(morpho?.summary).toBeUndefined()
    // The rating and the PSL exactly as published, one line per vault, by name.
    expect(morpho?.details?.map((detail) => [detail.name, detail.value])).toEqual([
      ['Gauntlet USDC Prime', 'A · PSL 0.002589947307'],
      ['KPK EURC Yield', 'A · PSL 0.002000000000000004'],
      ['Steakhouse Confidential Prime USDC', 'A · PSL 0.00321518900145001'],
      ['Yearn USDC', 'A · PSL 0.003204732543'],
    ])
    // A Morpho v1 vault names its curator by address, as published.
    expect(morpho?.details?.[0]?.description).toBe(
      'Curated by 0x9E33faAE38ff641094fa68c65c2cE600b3410585 · indicative rating · ' +
        'Published 2026-10-15',
    )
    expect(morpho?.extra?.facts).toEqual([
      { name: 'Credora protocol', value: 'morpho' },
      { name: 'Vaults rated', value: '4' },
      { name: 'Credora product', value: '"vault" (2), "vaults_v2" (2)' },
      { name: 'Indicative ratings', value: '4' },
      {
        name: 'PSL (the Score column)',
        value:
          'Probability of Significant Loss — annualized probability of a 1% loss on market supply',
      },
    ])
    expect(morpho?.extra?.vaults?.[1]).toEqual({
      name: 'KPK EURC Yield',
      version: 'vaults_v2',
      curator: 'KPK',
      tier: 'A',
      score: 0.002000000000000004,
      tvlUsd: null,
      scoredAt: '2026-10-14',
      url: `${VAULTS}/0xa877D5bb0274dcCbA8556154A30E1Ca4021a275f`,
    })

    const spark = await adapter.collect({ protocol: row('spark', 'Spark'), ctx, prepared })
    expect(spark).toMatchObject({ value: '2 vaults rated', updatedAt: '2026-10-12' })
    expect(spark?.details).toEqual([
      {
        name: 'Savings USDC',
        value: 'A- · PSL 0.0066',
        description: 'commissioned rating · Published 2026-10-12',
      },
      {
        name: 'Staked USDS',
        value: 'B+ · PSL 0.0091',
        description: 'commissioned rating · Published 2026-10-12',
      },
    ])
    expect(spark?.extra?.vaults?.map((vault) => [vault.version, vault.curator])).toEqual([
      ['savings', null],
      ['savings', null],
    ])
    // No further request per protocol.
    expect(ctx.requests).toEqual([QUERY])
  })

  it('reads vaults only, on Ethereum only, and names the products it left out', async () => {
    vi.stubEnv('CREDORA_API_KEY', 'test-key')
    // A Base vault from the same API, in case the server-side chain filter lets one through.
    const base = {
      id: '0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183',
      address: '0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183',
      name: 'Steakhouse USDC',
      chainId: 8453,
      protocol: 'Morpho',
      ratingType: 'indicative',
      product: 'vault',
      curator: { name: '0x827e86072B06674a077f592A531dcE4590aDeCdB' },
      Metrics: { rating: 'A', psl: 0.00170947296, publishDate: '2026-10-15' },
    }
    const listing = {
      data: { ratings: { ...ratings.data.ratings, items: [...ratings.data.ratings.items, base] } },
    }
    const ctx = fakeContext({ [QUERY]: listing }, { mapping })
    const logs: string[] = []
    ctx.log = (message) => logs.push(message)
    const prepared = await adapter.prepare!(ctx)
    expect(logs).toEqual([
      '9 ratings listed, 6 Ethereum vault(s) under 2 protocol(s)',
      'not read: 1 assets, 1 markets',
      'mapped but without Ethereum vaults: euler',
    ])
    const morpho = await adapter.collect({ protocol: row('morpho-vaults'), ctx, prepared })
    expect(morpho?.value).toBe('4 vaults rated')
    expect(morpho?.extra?.vaults?.map((vault) => vault.name)).not.toContain('Steakhouse USDC')
    expect(morpho?.extra?.vaults?.map((vault) => vault.name)).not.toContain('WBTC/WETH')
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
    expect(publishedOn(dated('2026-10-15'))).toBe('2026-10-15')
    // Credora's own documentation shows this one.
    expect(publishedOn(dated('2025-19-09'))).toBeNull()
    expect(publishedOn(dated('2025-09-19T00:00:00Z'))).toBeNull()
    expect(publishedOn(dated(null))).toBeNull()
  })
})
