import { fakeContext } from '@defi-dna/core/testing'
import { describe, expect, it } from 'vitest'
import morpho from './fixtures/morpho.org.json' with { type: 'json' }
import adapter from './index.ts'

const API = 'https://risklayer.online/api/protocols'
const protocol = { id: 'morpho-blue', name: 'Morpho Blue', category: 'lending' }

describe('risklayer', () => {
  it('carries the score and the band verbatim, with dimensions, facts and findings', async () => {
    const ctx = fakeContext(
      { [`${API}/morpho.org`]: morpho },
      { mapping: { 'morpho-blue': ['morpho.org'] } },
    )
    const result = await adapter.collect({ protocol, ctx, prepared: undefined })
    expect(result).toMatchObject({
      value: '4.8/10 · medium',
      updatedAt: '2026-06-09',
      url: 'https://risklayer.online/protocol/morpho.org',
    })
    expect(result?.details?.map((detail) => detail.name)).toEqual([
      'Dependency Risk',
      'Governance Risk',
      'Tokenomics Risk',
      'Audit Coverage Risk',
      'Smart Contract Risk',
    ])
    expect(result?.details?.[0]?.value).toMatch(/^\d\.\d\/10$/)
    expect(result?.extra?.facts).toEqual([
      { name: 'Analyzed domain', value: 'morpho.org' },
      { name: 'Risk level', value: 'medium' },
      { name: 'Overall score', value: '4.8' },
      { name: 'Analysis status', value: 'completed' },
    ])
    expect(result?.extra?.findings).toHaveLength(2)
    expect(result?.extra?.findings?.[0]).toMatchObject({ title: 'Unverified Morpho Blue on Base' })
  })

  it('reports a listed domain without a completed analysis as no value, not an error', async () => {
    const ctx = fakeContext(
      { [`${API}/example.fi`]: { name: 'Example' } },
      { mapping: { curve: ['example.fi'] } },
    )
    const result = await adapter.collect({
      protocol: { id: 'curve', name: 'Curve', category: 'dex' },
      ctx,
      prepared: undefined,
    })
    expect(result?.value).toBeUndefined()
    expect(result?.note).toContain('no completed analysis')
  })
})
