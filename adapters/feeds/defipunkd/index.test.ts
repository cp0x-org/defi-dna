import { fakeContext } from '@defi-dna/core/testing'
import { describe, expect, it } from 'vitest'
import aaveV3 from './fixtures/aave-v3.json' with { type: 'json' }
import crvusd from './fixtures/crvusd.json' with { type: 'json' }
import curveDex from './fixtures/curve-dex.json' with { type: 'json' }
import index from './fixtures/index.json' with { type: 'json' }
import adapter, { stateOf } from './index.ts'

/*
 * Real responses from 2026-10-17: `index.json` trimmed to five slugs, and the
 * detail files of `aave-v3` (a silver tier, every slice tentative),
 * `curve-dex` (silver, all tentative green) and `crvusd` (a wood tier with
 * partial and gray slices).
 */
const API = 'https://defipunkd.com/api/extension'
const INDEX = `${API}/index.json`
const responses = {
  [INDEX]: index,
  [`${API}/protocol/aave-v3.json`]: aaveV3,
  [`${API}/protocol/curve-dex.json`]: curveDex,
  [`${API}/protocol/crvusd.json`]: crvusd,
}
const mapping = {
  'aave-v3': ['aave-v3'],
  curve: ['curve-dex', 'crvusd'],
  'compound-v3': ['compound-v3'],
}
const row = (id: string, name = id) => ({ id, name, category: 'lending' })

describe('defipunkd adapter', () => {
  it('carries the five slices verbatim as the headline, with verdicts and the tier as a fact', async () => {
    const ctx = fakeContext(responses, { mapping })
    const prepared = await adapter.prepare!(ctx)
    const result = await adapter.collect({ protocol: row('aave-v3', 'Aave v3'), ctx, prepared })

    expect(result).toMatchObject({
      value:
        'Control: tentative orange · Ability to exit: tentative red · Autonomy: tentative orange · ' +
        'Open Access: tentative orange · Verifiability: tentative green',
      summary: aaveV3.about,
      url: 'https://defipunkd.com/protocol/aave-v3',
      note:
        'DeFiPunk’d files Aave v3 as Aave V3 ("aave-v3"). Grades cover the deployment on every ' +
        'chain it runs on, not Ethereum mainnet alone, and DeFiPunk’d publishes no date with them.',
    })
    // DeFiPunk’d publishes no date; our fetch time never stands in for one.
    expect(result?.updatedAt).toBeUndefined()
    expect(result?.details?.map((detail) => [detail.name, detail.value])).toEqual([
      ['Control', 'tentative orange'],
      ['Ability to exit', 'tentative red'],
      ['Autonomy', 'tentative orange'],
      ['Open Access', 'tentative orange'],
      ['Verifiability', 'tentative green'],
    ])
    expect(result?.details?.[0]?.description).toMatch(
      /^T1 upgrades reachable via ~5-day fast path — Assessed by 4 models — Choosing orange because /,
    )
    // The tier is review depth, not safety: a fact, never part of the headline.
    expect(result?.value).not.toContain('silver')
    expect(result?.extra?.facts).toEqual([
      { name: 'Tier', value: 'silver · Weak AI consensus on all dimensions' },
      { name: 'Category', value: 'Lending' },
      { name: 'Upgradeability', value: 'upgradeable' },
      { name: 'Bug bounty', value: 'https://audits.sherlock.xyz/bug-bounties/300' },
      { name: 'Governance forum', value: 'https://governance.aave.com' },
      { name: 'Docs', value: 'https://aave.com/docs' },
    ])
    expect(ctx.requests).toEqual([INDEX, `${API}/protocol/aave-v3.json`])
  })

  it('shows every slug under one row separately, with partial and gray slices as published', async () => {
    const ctx = fakeContext(responses, { mapping })
    const prepared = await adapter.prepare!(ctx)
    const result = await adapter.collect({ protocol: row('curve', 'Curve'), ctx, prepared })

    expect(result?.value).toBe(
      'Curve DEX — Control: tentative green, Ability to exit: tentative green, Autonomy: tentative ' +
        'green, Open Access: tentative green, Verifiability: tentative green · crvUSD — Control: ' +
        'tentative orange (3/3 models submitted), Ability to exit: tentative unknown (3/3 models ' +
        'submitted), Autonomy: tentative orange, Open Access: tentative unknown (2/3 models ' +
        'submitted), Verifiability: tentative green',
    )
    expect(result?.details).toHaveLength(10)
    expect(result?.details?.[6]).toMatchObject({
      name: 'crvUSD · Ability to exit',
      value: 'tentative unknown (3/3 models submitted)',
    })
    // A partial slice's model count is in its value, not repeated in the description.
    expect(result?.details?.[6]?.description).not.toContain('Assessed by')
    expect(result?.summary).toMatch(/^Curve DEX is an automated market maker /)
    expect(result?.note).toContain(
      'DeFiPunk’d files Curve as Curve DEX ("curve-dex") and crvUSD ("crvusd"); each is graded ' +
        'separately and every one is shown.',
    )
    expect(result?.extra?.facts).toContainEqual({
      name: 'Tier (crvUSD)',
      value: 'wood · At least one model submission, no quorum yet',
    })
    expect(result?.extra?.text).toEqual([
      'Curve DEX: https://defipunkd.com/protocol/curve-dex',
      'crvUSD: https://defipunkd.com/protocol/crvusd',
    ])
  })

  it('reports a mapped slug the index does not list as a note, and an unmapped row as null', async () => {
    const ctx = fakeContext(responses, { mapping })
    const logs: string[] = []
    ctx.log = (message) => logs.push(message)
    const prepared = await adapter.prepare!(ctx)
    expect(logs).toEqual(['5 slugs listed', 'mapped but not listed: compound-v3'])

    const compound = await adapter.collect({ protocol: row('compound-v3'), ctx, prepared })
    expect(compound?.value).toBeUndefined()
    expect(compound).toEqual({
      url: 'https://defipunkd.com/protocol/compound-v3',
      note: 'DeFiPunk’d lists no assessment under "compound-v3".',
    })
    await expect(adapter.collect({ protocol: row('lido'), ctx, prepared })).resolves.toBeNull()
    // No detail read for either.
    expect(ctx.requests).toEqual([INDEX])
  })

  it('fails loudly when the source cannot be read, instead of reporting a gap', async () => {
    await expect(adapter.prepare!(fakeContext({ [INDEX]: {} }, { mapping }))).rejects.toThrow(
      'no `protocols` object',
    )
    const ctx = fakeContext({ ...responses, [`${API}/protocol/aave-v3.json`]: null }, { mapping })
    const prepared = await adapter.prepare!(ctx)
    await expect(adapter.collect({ protocol: row('aave-v3'), ctx, prepared })).rejects.toThrow(
      'HTTP 404',
    )
  })

  it("words a slice's state the way DeFiPunk’d titles it", () => {
    const slice = { id: 'control', label: 'Control', tentative: false, partial: false }
    expect(stateOf({ ...slice, grade: 'green' })).toBe('green')
    expect(stateOf({ ...slice, grade: 'gray' })).toBe('unknown')
    expect(stateOf({ ...slice, grade: 'red', tentative: true })).toBe('tentative red')
    expect(stateOf({ ...slice, grade: 'orange', partial: true, modelsCount: 1 })).toBe(
      'tentative orange (1/3 models submitted)',
    )
    // The index carries no model count.
    expect(stateOf({ ...slice, grade: 'orange', partial: true })).toBe('tentative orange')
  })
})
