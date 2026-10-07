import { fakeContext } from '@defi-dna/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import listing from './fixtures/vaults.json' with { type: 'json' }
import adapter, { assess, type Vault } from './index.ts'

const vault = (overrides: Partial<Vault>): Vault => ({
  strategy_id: 1,
  protocol_name: 'Morpho',
  chain_id: 1,
  pool_name: 'Example USDC',
  display_name: 'Example USDC',
  type: 'Lending',
  tvl_30d_ma: 1_000_000,
  updated_at: '2026-10-01T00:00:00+00:00',
  risk_band: null,
  risk_score: null,
  ...overrides,
})

describe('assess', () => {
  const listed = [
    vault({
      strategy_id: 10,
      display_name: 'Small',
      tvl_30d_ma: 2e6,
      risk_band: 'F',
      risk_score: 17,
    }),
    vault({ strategy_id: 11, display_name: 'Unrated', tvl_30d_ma: 9e9 }),
    vault({
      strategy_id: 12,
      protocol_name: 'Morpho v2',
      display_name: null,
      pool_name: 'Large',
      tvl_30d_ma: 5e7,
      updated_at: '2026-09-30T00:00:00+00:00',
      risk_band: 'B',
      risk_score: 81.94,
    }),
  ]

  it('counts rated vaults only and lists them by TVL, scores verbatim', () => {
    const result = assess(['Morpho', 'Morpho v2'], listed)
    expect(result.value).toBe('2 vaults rated')
    expect(result.details?.map((d) => [d.name, d.value])).toEqual([
      ['Large', 'B · 81.94/100'],
      ['Small', 'F · 17/100'],
    ])
    expect(result.updatedAt).toBe('2026-10-01')
    expect(result.extra?.facts).toEqual([
      { name: 'Vaults listed', value: '3' },
      { name: 'Vaults rated', value: '2' },
    ])
    expect(result.extra?.vaults?.[0]).toEqual({
      name: 'Large',
      version: 'Morpho v2',
      curator: null,
      tier: 'B',
      score: 81.94,
      tvlUsd: 5e7,
      scoredAt: '2026-09-30',
      url: 'https://app.pigi.finance/vault/12',
    })
  })

  it('reports a listed but unrated protocol as no value, not an error', () => {
    const result = assess(['Curve'], [vault({ protocol_name: 'Curve' })])
    expect(result.value).toBeUndefined()
    expect(result.note).toContain('1 Ethereum vault(s) under Curve')
  })

  it('reports a protocol pigi does not list', () => {
    expect(assess(['Gearbox'], [])).toMatchObject({
      note: 'pigi lists no Ethereum vault under Gearbox.',
    })
  })

  it('counts every rated vault but carries only the 100 largest into extra', () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      vault({
        strategy_id: i,
        display_name: `Vault ${i}`,
        tvl_30d_ma: i,
        risk_band: 'C',
        risk_score: 50,
      }),
    )
    const result = assess(['Morpho'], many)
    expect(result.value).toBe('120 vaults rated')
    expect(result.extra?.facts).toContainEqual({ name: 'Vaults rated', value: '120' })
    expect(result.extra?.vaults).toHaveLength(100)
    expect(result.extra?.vaults?.[0]?.name).toBe('Vault 119')
    expect(result.note).toContain('20 more are at the source')
  })
})

const LISTING = 'https://pigi.finance/api/v1/vaults?chain_id=1&sort=id_asc&limit=1000&offset=0'
const TOKEN = 'POST https://pigi.finance/api/v1/auth/token'

describe('prepare and collect', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('trades the key for a token once, reads one listing, and never touches the network per protocol', async () => {
    vi.stubEnv('PIGI_API_KEY', 'test-key')
    const ctx = fakeContext(
      { [TOKEN]: { token: 't' }, [LISTING]: listing },
      { mapping: { 'morpho-vaults': ['Morpho', 'Morpho v2'], curve: ['Curve'] } },
    )
    const prepared = await adapter.prepare!(ctx)
    expect(ctx.requests).toEqual([LISTING, TOKEN])

    const morpho = await adapter.collect({
      protocol: { id: 'morpho-vaults', name: 'Morpho Vaults', category: 'yield' },
      ctx,
      prepared,
    })
    expect(morpho?.value).toBe('2 vaults rated')
    expect(morpho?.extra?.facts).toEqual([
      { name: 'Vaults listed', value: '3' },
      { name: 'Vaults rated', value: '2' },
    ])
    expect(morpho?.extra?.vaults?.map((vault) => vault.tier)).toEqual(['B', 'B'])

    const curve = await adapter.collect({
      protocol: { id: 'curve', name: 'Curve', category: 'dex' },
      ctx,
      prepared,
    })
    expect(curve?.value).toBeUndefined()
    expect(curve?.note).toContain('1 Ethereum vault(s) under Curve')
    expect(ctx.requests).toHaveLength(2)
  })

  it('declares the key it needs', () => {
    expect(adapter.secrets).toEqual(['PIGI_API_KEY'])
  })
})
