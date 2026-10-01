import { describe, expect, it } from 'vitest'
import { assess, type Vault } from './index.ts'

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
    expect(result.extra).toMatchObject({ vaultsListed: 3, vaultsRated: 2 })
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
})
