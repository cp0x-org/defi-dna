import { fakeContext } from '@defi-dna/core/testing'
import { describe, expect, it } from 'vitest'
import adapter, { assess, assessReview, countsOf, findingsOf, headlineOf } from './index.ts'

/*
 * Shaped like Lido's compiled review: a governance contract and a multisig that
 * can reach the funds, keys that cannot, one external dependency, and
 * mitigations on some of the functions that touch funds.
 */
const reach = { fundsAtRisk: true, fundsUsd: 115_419_399.8 }
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
      name: 'Deposit Guardian EOA',
      adminType: 'EOA',
      isGovernance: false,
      totalReachableCapital: 0,
      description: 'Can pause deposits.',
      functions: [{ directFundsUsd: 0, reachableContracts: [] }],
    },
    {
      name: 'Lido DAO Agent',
      adminType: 'Contract',
      isGovernance: true,
      totalReachableCapital: 115_541_322.47,
      description: 'The execution endpoint of Lido DAO governance.',
      functions: [
        {
          directFundsUsd: 0,
          reachableContracts: [reach],
          mitigations: [
            { type: 'delay', delaySeconds: 259_200 },
            { type: 'other', description: 'bounded pause authority' },
          ],
        },
        { directFundsUsd: 1_000, reachableContracts: [] },
      ],
    },
    {
      name: 'Emergency Execution 5/7 Multisig',
      adminType: 'Multisig',
      isGovernance: false,
      totalReachableCapital: 115_419_399.8,
      description: 'Executes in emergency mode.',
      functions: [
        {
          directFundsUsd: 0,
          reachableContracts: [reach],
          mitigations: [{ type: 'delay', delaySeconds: 86_400 }],
        },
      ],
    },
  ],
  contracts: [
    { isExternal: false, proxyType: 'EIP1967 proxy' },
    { isExternal: false, proxyType: 'immutable' },
    { isExternal: true, proxyType: 'immutable' },
  ],
  dependencies: [{ entity: 'Ethereum Deposit Contract', functions: [] }],
}

describe('findingsOf', () => {
  it('derives the key findings the way DeFiScan’s page does, in its words', () => {
    const findings = findingsOf(sample)
    expect(findings.map((finding) => [finding.severity, finding.title])).toEqual([
      ['warning', '1 multisig with permissioned access'],
      ['info', '$26.78B TVS'],
      ['warning', '1 external vendor'],
      ['info', '2 out of 3 functions with potential impact on funds have mitigations'],
    ])
    expect(findings[0]?.description).toBe(
      'Multisig wallets provide distributed control but still require trust in a known group of signers. Emergency Execution 5/7 Multisig.',
    )
    expect(findings[1]?.description).toBe(
      'Total Value Secured by the protocol: $115.5M in TVL (funds locked in protocol contracts) and $26.66B in protocol token market cap.',
    )
    expect(findings[2]?.description).toMatch(
      /^The protocol depends on 1 external contract from 1 vendor,/,
    )
    // Only functions that can reach funds count; the delays are listed in DeFiScan's units.
    expect(findings[3]?.description).toBe(
      'Taking into account only functions which can impact funds. Mitigations include time delays (1 day, 3 days) and additional safeguards.',
    )
  })

  it('flags keys that can reach funds, and an immutable protocol with no admin at all', () => {
    const keyed = findingsOf({
      admins: [{ name: 'Deployer', adminType: 'EOA', totalReachableCapital: 723_638 }],
      dependencies: [{ entity: null }, { entity: null }],
    })
    expect(keyed.map((finding) => finding.title)).toEqual([
      '1 EOA with permissioned access',
      '2 external dependencies',
    ])
    expect(keyed[0]).toMatchObject({
      severity: 'critical',
      description:
        'Externally owned account can execute critical functions affecting up to $724K in TVL.',
    })

    const immutable = findingsOf({
      admins: [{ name: 'Factory', adminType: 'Immutable' }],
      contracts: [{ isExternal: false, proxyType: 'immutable' }],
      dependencies: [],
    })
    expect(immutable.map((finding) => [finding.severity, finding.title])).toEqual([
      ['positive', 'Fully immutable protocol'],
      ['positive', 'Fully autonomous protocol'],
    ])
  })

  it('yields nothing from a review without the fields the rules read', () => {
    expect(findingsOf({ project: 'empty' })).toEqual([])
  })
})

describe('headlineOf', () => {
  it('names the flagged findings, else the positive ones, else the published counts', () => {
    const findings = findingsOf(sample)
    expect(headlineOf(findings, sample.totals)).toBe(
      '1 multisig with permissioned access · 1 external vendor',
    )
    const calm = findings.filter((finding) => finding.severity === 'info')
    expect(headlineOf(calm, sample.totals)).toBe('20 admins · $115.5M capital at risk')
    expect(
      headlineOf(
        [
          ...calm,
          {
            title: 'Fully autonomous protocol',
            severity: 'positive',
            category: null,
            description: null,
          },
        ],
        sample.totals,
      ),
    ).toBe('Fully autonomous protocol')
  })
})

describe('countsOf', () => {
  it('uses admin count and capital at risk, not a Stage', () => {
    expect(countsOf(sample.totals)).toBe('20 admins · $115.5M capital at risk')
  })

  it('falls back to contracts when capital at risk is zero', () => {
    expect(countsOf({ adminCount: 0, totalCapitalAtRisk: 0, contractCount: 18 })).toBe(
      '0 admins · 18 contracts',
    )
  })
})

describe('assessReview', () => {
  it('quotes DeFiScan totals, description and top admins beside the findings', () => {
    const assessed = assessReview('lido', sample)
    expect(assessed).toMatchObject({
      slug: 'lido',
      headline: '1 multisig with permissioned access · 1 external vendor',
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
    expect(assessed?.findings).toHaveLength(4)
  })

  it('returns null when the review has no usable totals', () => {
    expect(assessReview('empty', { project: 'empty' })).toBeNull()
  })
})

describe('assess', () => {
  it('keeps the review date distinct from the compile date in the note, and carries the findings', () => {
    const assessed = assessReview('lido', sample)
    expect(assessed).not.toBeNull()
    const result = assess([assessed!])
    expect(result.value).toBe('1 multisig with permissioned access · 1 external vendor')
    expect(result.updatedAt).toBe('2025-06-19')
    expect(result.note).toContain('Review covers Ethereum.')
    expect(result.note).toContain('derives from this review, under its rules and in its words')
    expect(result.note).toContain('compiled JSON was rebuilt on 2026-09-30')
    expect(result.extra?.findings).toHaveLength(4)
    expect(result.extra?.text).toBeUndefined()
  })
})

const DATA = 'https://www.defiscan.info/data'
const lido = { id: 'lido', name: 'Lido', category: 'liquid-staking' }

describe('collect', () => {
  it('reads every slug a row maps to and names them all in the note', async () => {
    const ctx = fakeContext(
      {
        [`${DATA}/lido/compiled-review.json`]: sample,
        [`${DATA}/lido-csm/compiled-review.json`]: {
          project: 'lido-csm',
          publishedAt: '2025-08-01T00:00:00.000Z',
          totals: { adminCount: 3, contractCount: 18 },
        },
        [`${DATA}/lido-v3/compiled-review.json`]: null,
      },
      { mapping: { lido: ['lido', 'lido-csm', 'lido-v3'] } },
    )
    const result = await adapter.collect({ protocol: lido, ctx, prepared: undefined })
    expect(result).toMatchObject({
      // A review without the fields the findings read keeps the published counts.
      value: '1 multisig with permissioned access · 1 external vendor · 3 admins · 18 contracts',
      updatedAt: '2025-08-01',
      url: 'https://www.defiscan.info/protocol/lido',
    })
    expect(result?.note).toContain('2 reviews: lido, lido-csm')
    expect(result?.extra?.text).toHaveLength(2)
    expect(ctx.requests).toHaveLength(3)
  })

  it('answers null for a protocol the mapping leaves out', async () => {
    const ctx = fakeContext({}, { mapping: { lido: ['lido'] } })
    await expect(
      adapter.collect({
        protocol: { id: 'curve', name: 'Curve', category: 'dex' },
        ctx,
        prepared: undefined,
      }),
    ).resolves.toBeNull()
    expect(ctx.requests).toEqual([])
  })
})
