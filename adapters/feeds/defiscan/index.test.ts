import { fakeContext } from '@defi-dna/core/testing'
import { describe, expect, it } from 'vitest'
import reviews from './fixtures/reviews.json' with { type: 'json' }
import adapter, { parseReview } from './index.ts'

const review = `---
protocol: "Aave"
chain: "ethereum"
stage: "1"
risks: ["L", "M", "L", "H", "L"]
publish_date: "2024-11-05"
update_date: "1970-01-01"
---

# Summary

Aave is a lending protocol.

More text.
`

describe('parseReview', () => {
  it('reads the stage, the risk levels and the published date', () => {
    expect(parseReview(review)).toMatchObject({
      stage: '1',
      risks: ['L', 'M', 'L', 'H', 'L'],
      date: '2024-11-05',
      summary: 'Aave is a lending protocol.',
    })
  })

  it('survives a head that was cut off mid-file', () => {
    expect(parseReview('---\nstage: "2"\nrisks: ["L"')).toMatchObject({ stage: '2', risks: [] })
  })
})

/** Trimmed heads of real review files, keyed by the path DeFiScan publishes them under. */
const RAW = 'https://raw.githubusercontent.com/deficollective/defiscan/main/src/content/protocols'
const responses = Object.fromEntries(
  Object.entries(reviews).map(([file, text]) => [`${RAW}/${file}`, text]),
)

describe('collect', () => {
  it('reads every review a row maps to and joins the stages they publish', async () => {
    const ctx = fakeContext(
      { ...responses, [`${RAW}/aave/etherfi.md`]: null },
      { mapping: { 'aave-v3': ['aave/ethereum.md', 'aave/prime.md', 'aave/etherfi.md'] } },
    )
    const result = await adapter.collect({
      protocol: { id: 'aave-v3', name: 'Aave v3', category: 'lending' },
      ctx,
      prepared: undefined,
    })
    expect(result).toMatchObject({
      value: 'Stage 0',
      updatedAt: '2025-05-07',
      url: 'https://www.defiscan.info/protocols/aave/ethereum',
    })
    expect(result?.details?.map((detail) => detail.value)).toEqual(['L', 'H', 'H', 'H', 'L'])
    expect(result?.extra?.reviews?.map((entry) => entry.file)).toEqual([
      'aave/ethereum.md',
      'aave/prime.md',
    ])
    expect(result?.note).toContain('2 reviews')
  })

  it('answers null for a protocol the mapping leaves out', async () => {
    const ctx = fakeContext(responses, { mapping: { 'morpho-blue': ['morpho/ethereum.md'] } })
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
