import { fakeContext } from '@defi-dna/core/testing'
import { describe, expect, it } from 'vitest'
import hacks from './fixtures/hacks.json' with { type: 'json' }
import adapter from './index.ts'

const HACKS = 'https://api.llama.fi/hacks'

describe('incidents', () => {
  it('attributes incidents by DefiLlama id only, newest first', async () => {
    const ctx = fakeContext({ [HACKS]: hacks })
    const prepared = await adapter.prepare!(ctx)

    const aave = await adapter.collect({
      protocol: { id: 'aave-v3', name: 'Aave v3', category: 'lending' },
      ctx,
      prepared,
    })
    expect(aave?.value).toBe(1)
    expect(aave?.extra?.incidents?.[0]).toMatchObject({
      date: '2026-03-12',
      name: 'Aave V3',
      amountUsd: 862000,
      classification: 'Oracle Manipulation',
    })

    const zerox = await adapter.collect({
      protocol: { id: 'zerox', name: '0x', category: 'aggregator' },
      ctx,
      prepared,
    })
    expect(zerox?.value).toBe(0)
    expect(zerox?.note).toContain('not proof')

    await expect(
      adapter.collect({ protocol: { id: 'unmapped', name: 'X', category: 'x' }, ctx, prepared }),
    ).resolves.toBeNull()
  })
})
