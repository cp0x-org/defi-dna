import { fakeContext } from '@defi-dna/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import aaveCore from './fixtures/aave-v3-ethereum.json' with { type: 'json' }
import listing from './fixtures/protocols.json' with { type: 'json' }
import sparklend from './fixtures/sparklend.json' with { type: 'json' }
import adapter, { assess, type ListedNode, type Node, type NodeVault } from './index.ts'

const API = 'https://pigi.finance/api/v1'
const LISTING = `${API}/protocols?chain_id=1`
const TOKEN = `POST ${API}/auth/token`
const node = (id: string) => `${API}/protocols/${id}?chain_id=1`
const DOCS = 'https://app.pigi.finance/defi-api-docs#api-v1-protocols-node-id'
const listed = (id: string): ListedNode => listing.data.find((row) => row.node_id === id)!
const AAVE = ['aave-v3-ethereum', 'aave-v3-ethereum-lido', 'aave-v3-ethereum-horizon']

describe('assess', () => {
  it('carries the node’s score and band verbatim, with the terms behind it and the vaults that counted', () => {
    const result = assess(['sparklend'], sparklend)
    expect(result.value).toBe('B 82.23/100')
    expect(result.summary).toBe('SparkLend — Aave v3.0.2 fork under Sky governance (Ethereum)')
    expect(result.details?.map((detail) => [detail.name, detail.value])).toEqual([
      ['Node rating', '80/100'],
      ['Vault score, TVL-weighted', '85.57'],
      ['Weights', 'node 0.6 · vaults 0.4'],
    ])
    // Each term says what it is, for the help popover next to it.
    expect(result.details?.[0]?.description).toBe(
      'pigi’s own rating of sparklend itself, 0–100, higher = safer. Its rubric covers audits ' +
        'and bounty, admin and pause authority, operational history and scale. ' +
        'Rated 2026-09-22, methodology 1.14.0. Weight in the score: 0.6.',
    )
    expect(result.details?.[1]?.description).toBe(
      'The mean of pigi’s latest scores of the 9 rated Ethereum vault(s) that deposit into ' +
        'sparklend, weighted by their 30-day average TVL ($3.87B in all). Weight in the score: 0.4. ' +
        'Vaults by band: A 4, B 2, C 3, D 0, F 0.',
    )
    expect(result.extra?.facts).toBeUndefined()
    expect(result.updatedAt).toBe('2026-10-11')
    // pigi's API answers only with a key, so the card links the rating's public documentation.
    expect(result.url).toBe(DOCS)
    expect(result.note).toBe('Headline: sparklend. Vault score counts Ethereum vaults only.')
    expect(result.extra?.vaults?.[0]).toEqual({
      name: 'SparkLend WETH',
      version: 'SparkLend',
      curator: null,
      tier: 'A',
      score: 89.8,
      tvlUsd: 1560376499,
      scoredAt: '2026-10-11',
      url: 'https://app.pigi.finance/vault/3906',
    })
    // A vault pigi files under another protocol counts toward the node and is listed with it.
    expect(result.extra?.vaults?.map((vault) => vault.version)).toContain('Fluid (InstaDapp)')
    expect(result.extra?.text).toEqual([sparklend.formula.note])
  })

  it('heads the row with one node and lists the others separately, never combined', () => {
    const result = assess(AAVE, aaveCore, [
      listed('aave-v3-ethereum-lido'),
      listed('aave-v3-ethereum-horizon'),
    ])
    expect(result.value).toBe('C 67.88/100')
    // No links for the other nodes: pigi has no public page for them.
    expect(result.extra?.facts).toEqual([
      {
        name: 'Aave v3 — Ethereum Prime (Lido) instance (pool rev 11)',
        value: 'C 69.96/100 · 2026-10-11',
      },
      {
        name: 'Aave Horizon — Ethereum RWA instance (Aave v3.3 fork, pool rev 7)',
        value: 'C 61.38/100 · 2026-10-11',
      },
    ])
    expect(result.note).toBe(
      'Headline: aave-v3-ethereum. Also rated, shown separately: aave-v3-ethereum-lido, ' +
        'aave-v3-ethereum-horizon. Vault score counts Ethereum vaults only.',
    )
    // The vault table backs the headline only.
    expect(result.extra?.vaults?.map((vault) => vault.name)).toEqual([
      'Wrapped Ether',
      'Wrapped eETH',
      'Instadapp ETH v2',
    ])
  })

  it('leaves out the vault score when no rated vault counted', () => {
    const alone: Node = {
      ...sparklend,
      applied: { k1: 1, k2: 0, vault_aggregation: 'none' },
      vaults: { rated_count: 0, tvl_usd: 0, score_tvl_weighted: null, items: [] },
    }
    expect(assess(['sparklend'], alone).details?.map((detail) => detail.name)).toEqual([
      'Node rating',
      'Weights',
    ])
  })

  it('names a mapped node pigi does not rate', () => {
    expect(assess(['curve'], null)).toEqual({
      note: 'pigi publishes no protocol rating for curve.',
    })
    expect(assess(['gone', 'sparklend'], sparklend).note).toContain('Not rated by pigi: gone.')
  })

  it('carries only the 100 largest vaults into extra and says how many are left out', () => {
    const items: NodeVault[] = Array.from({ length: 120 }, (_, i) => ({
      strategy_id: i,
      name: `Vault ${i}`,
      protocol_name: 'Morpho v2',
      score: 50,
      band: 'C',
      date: '2026-10-11',
      tvl_usd: i,
    }))
    const many: Node = { ...sparklend, vaults: { ...sparklend.vaults, items } }
    const result = assess(['sparklend'], many)
    expect(result.extra?.vaults).toHaveLength(100)
    expect(result.extra?.vaults?.[0]?.name).toBe('Vault 119')
    expect(result.note).toContain('Top 100 vaults by TVL shown, 20 more at pigi.')
  })
})

describe('prepare and collect', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('trades the key once, reads the listing once and one detail per covered row', async () => {
    vi.stubEnv('PIGI_API_KEY', 'test-key')
    const ctx = fakeContext(
      {
        [TOKEN]: { token: 't' },
        [LISTING]: listing,
        [node('sparklend')]: sparklend,
        [node('aave-v3-ethereum')]: aaveCore,
      },
      { mapping: { 'aave-v3': AAVE, spark: ['sparklend'], curve: ['curve'] } },
    )
    const prepared = await adapter.prepare!(ctx)
    expect(ctx.requests).toEqual([LISTING, TOKEN])

    const collect = (id: string) =>
      adapter.collect({ protocol: { id, name: id, category: 'lending' }, ctx, prepared })
    expect((await collect('spark'))?.value).toBe('B 82.23/100')
    const aave = await collect('aave-v3')
    expect(aave?.value).toBe('C 67.88/100')
    expect(aave?.extra?.facts?.map((fact) => fact.value)).toEqual([
      'C 69.96/100 · 2026-10-11',
      'C 61.38/100 · 2026-10-11',
    ])
    expect((await collect('curve'))?.value).toBeUndefined()
    expect(await collect('lido')).toBeNull()

    // The row's other nodes come from the listing, and an unlisted node is never asked
    // for: every request, a 404 too, counts against the quota.
    expect(ctx.requests).toEqual([LISTING, TOKEN, node('sparklend'), node('aave-v3-ethereum')])
  })

  it('declares the key it needs', () => {
    expect(adapter.secrets).toEqual(['PIGI_API_KEY'])
  })
})
