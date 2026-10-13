import { fakeContext } from '@defi-dna/core/testing'
import { describe, expect, it } from 'vitest'
import listing from './fixtures/protocols2.json' with { type: 'json' }
import adapter from './index.ts'

const LIST = 'https://api.llama.fi/lite/protocols2'
const mapping = { 'aave-v3': ['1599'], spark: ['2929', '424242'], curve: ['424242'] }

describe('tvl', () => {
  it('sums exactly the DefiLlama ids a row maps to, in whole dollars, with the breakdown', async () => {
    const ctx = fakeContext({ [LIST]: listing }, { mapping })
    const prepared = await adapter.prepare!(ctx)

    const aave = await adapter.collect({
      protocol: { id: 'aave-v3', name: 'Aave v3', category: 'lending' },
      ctx,
      prepared,
    })
    expect(aave).toMatchObject({
      value: 15272106283,
      url: 'https://defillama.com/protocol/aave-v3',
    })
    expect(aave?.extra?.components).toEqual([{ id: '1599', name: 'Aave V3', tvl: 15272106283 }])

    // An id DefiLlama does not list is left out of the sum and the breakdown.
    const spark = await adapter.collect({
      protocol: { id: 'spark', name: 'Spark', category: 'lending' },
      ctx,
      prepared,
    })
    expect(spark?.value).toBe(5677865887)
    expect(spark?.extra?.components).toHaveLength(1)

    const curve = await adapter.collect({
      protocol: { id: 'curve', name: 'Curve', category: 'dex' },
      ctx,
      prepared,
    })
    expect(curve?.value).toBeNull()
    expect(curve?.note).toContain('no Ethereum TVL')
    expect(ctx.requests).toEqual([LIST])
  })
})
