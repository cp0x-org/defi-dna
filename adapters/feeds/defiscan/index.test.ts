import { describe, expect, it } from 'vitest'
import { assess, assessReview, headlineOf } from './index.ts'

const sample = {
  project: 'lido',
  publishedAt: '2025-06-19T00:00:00.000Z',
  lastModified: '2025-06-19T12:00:00.000Z',
  compiledAt: '2026-09-30T13:36:34.000Z',
  metadata: {
    protocolName: 'Lido',
    protocolSlug: 'lido',
    chain: 'Ethereum',
    description: 'Lido is a liquid-staking protocol.\n\nMore detail follows.',
  },
  totals: {
    contractCount: 256,
    permissionedFunctionCount: 498,
    adminCount: 20,
    dependencyCount: 1,
    totalCapitalAtRisk: 115_541_322.47,
    totalTokenValueAtRisk: 26_662_225_806.76,
    coverage: 100,
  },
  admins: [
    {
      name: 'Small Admin',
      adminType: 'EOA',
      isGovernance: false,
      totalReachableCapital: 1_000,
      description: 'A small admin.',
    },
    {
      name: 'Lido DAO Agent',
      adminType: 'Contract',
      isGovernance: true,
      totalReachableCapital: 115_541_322.47,
      description: 'The execution endpoint of Lido DAO governance.',
    },
  ],
}

describe('headlineOf', () => {
  it('uses admin count and capital at risk, not a Stage', () => {
    expect(headlineOf(sample.totals)).toBe('20 admins · $115.5M capital at risk')
  })

  it('falls back to contracts when capital at risk is zero', () => {
    expect(headlineOf({ adminCount: 0, totalCapitalAtRisk: 0, contractCount: 18 })).toBe(
      '0 admins · 18 contracts',
    )
  })
})

describe('assessReview', () => {
  it('quotes DeFiScan totals, description and top admins', () => {
    const assessed = assessReview('lido', sample)
    expect(assessed).toMatchObject({
      slug: 'lido',
      headline: '20 admins · $115.5M capital at risk',
      summary: 'Lido is a liquid-staking protocol. More detail follows.',
      updatedAt: '2025-06-19',
      compiledAt: '2026-09-30',
      chain: 'Ethereum',
      url: 'https://www.defiscan.info/protocol/lido',
    })
    expect(assessed?.details.slice(0, 3)).toEqual([
      { name: 'Admins', value: '20' },
      { name: 'Contracts', value: '256' },
      { name: 'Permissioned functions', value: '498' },
    ])
    expect(assessed?.details.find((detail) => detail.name === 'Lido DAO Agent')).toMatchObject({
      name: 'Lido DAO Agent',
      value: '$115.5M reachable',
    })
  })

  it('returns null when the review has no usable totals', () => {
    expect(assessReview('empty', { project: 'empty' })).toBeNull()
  })
})

describe('assess', () => {
  it('keeps the review date distinct from the compile date in the note', () => {
    const assessed = assessReview('lido', sample)
    expect(assessed).not.toBeNull()
    const result = assess([assessed!])
    expect(result.value).toBe('20 admins · $115.5M capital at risk')
    expect(result.updatedAt).toBe('2025-06-19')
    expect(result.note).toContain('Review covers Ethereum.')
    expect(result.note).toContain('compiled JSON was rebuilt on 2026-09-30')
    expect(result.extra).toBeUndefined()
  })
})
