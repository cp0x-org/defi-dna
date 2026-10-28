import { fakeContext } from '@defi-dna/core/testing'
import { describe, expect, it } from 'vitest'
import index from './fixtures/index.json' with { type: 'json' }
import adapter from './index.ts'

const API = 'https://imal1ice.github.io/admin-feed/control/index.json'
const responses = { [API]: index }
const mapping = {
  'aave-v3': ['aave-v3'],
  'balancer-v2': ['balancer-v2'],
  lido: ['lido'],
  curve: ['curve'],
}
const row = (id: string, name: string) => ({ id, name, category: 'lending' })

describe('ownerwatch adapter', () => {
  it('returns both counts verbatim, one detail per watched contract, the build date and the facts', async () => {
    const ctx = fakeContext(responses, { mapping })
    const prepared = await adapter.prepare!(ctx)
    const result = await adapter.collect({ protocol: row('aave-v3', 'Aave v3'), ctx, prepared })
    expect(result).toMatchObject({
      value: '2 control changes · 19 governance executions in 90 days',
      updatedAt: '2026-10-28',
      url: 'https://imal1ice.github.io/admin-feed/control/#aave-governance-v3',
    })
    expect(result?.note).toBeUndefined()
    expect(result?.details?.map((detail) => detail.name)).toEqual([
      'Payloads Controller',
      'Governance V3',
      'Protocol Guardian',
      'Governance Guardian',
      'Risk Council',
      'Executor Lvl 1',
    ])
    expect(result?.details?.[4]).toEqual({
      name: 'Risk Council',
      value: '2 · last 2026-10-22',
      description: 'safe 0x47c71dFEB55Ebaa431Ae3fbF99Ea50e0D3d30fA8, watched since 2026-10-28',
    })
    expect(result?.extra?.facts).toEqual([
      { name: 'Governance system', value: 'Aave Governance V3' },
      { name: 'Window', value: '90 days from 2026-07-30' },
      { name: 'Last counted event', value: '2026-10-28' },
      {
        name: 'Contract addresses from',
        value:
          'https://github.com/bgd-labs/aave-address-book/blob/main/src/GovernanceV3Ethereum.sol',
      },
    ])
    expect(ctx.requests).toEqual([API])
  })

  it('keeps the note of a protocol governed through Safes, which counts control changes only', async () => {
    const ctx = fakeContext(responses, { mapping })
    const prepared = await adapter.prepare!(ctx)
    const result = await adapter.collect({
      protocol: row('balancer-v2', 'Balancer v2'),
      ctx,
      prepared,
    })
    expect(result?.value).toBe('2 control changes in 90 days')
    expect(result?.note).toMatch(/^Governed through Safes/)
  })

  it('returns the note and no value where ownerwatch cannot decode the governance events yet', async () => {
    const ctx = fakeContext(responses, { mapping })
    const prepared = await adapter.prepare!(ctx)
    const result = await adapter.collect({ protocol: row('lido', 'Lido'), ctx, prepared })
    expect(result).toEqual({
      url: 'https://imal1ice.github.io/admin-feed/control/#lido-dao',
      note: expect.stringMatching(
        /^ownerwatch decodes Lido's Aragon votes but not yet Dual Governance/,
      ),
    })
  })

  it('says so when a mapped protocol is missing from the published file', async () => {
    const ctx = fakeContext(responses, { mapping })
    const prepared = await adapter.prepare!(ctx)
    const result = await adapter.collect({ protocol: row('curve', 'Curve'), ctx, prepared })
    expect(result).toEqual({ note: 'ownerwatch lists nothing for Curve.' })
  })

  it('returns null for a protocol the mapping does not cover', async () => {
    const ctx = fakeContext(responses, { mapping })
    const prepared = await adapter.prepare!(ctx)
    expect(await adapter.collect({ protocol: row('mellow', 'Mellow'), ctx, prepared })).toBeNull()
  })
})
