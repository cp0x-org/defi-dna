import { describe, expect, it } from 'vitest'
import { parseReview } from './index.ts'

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
