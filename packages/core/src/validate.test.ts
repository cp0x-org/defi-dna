import { describe, expect, it } from 'vitest'
import { validateFeedData, validateMetricData } from './validate.ts'

const since = '2026-10-01T00:00:00.000Z'

describe('validateFeedData', () => {
  it('accepts a cell with data, one without, and an error', () => {
    expect(
      validateFeedData({
        status: 'ok',
        value: 'Stage 1',
        details: [{ name: 'Chain', value: 'L' }],
        url: 'https://example.com/p',
        extra: { facts: [{ name: 'Listed', value: '3' }], text: ['A note.'] },
        since,
      }),
    ).toBeNull()
    expect(validateFeedData({ status: 'none', note: 'Nothing mapped.', since })).toBeNull()
    expect(validateFeedData({ status: 'error', note: 'HTTP 503', since })).toBeNull()
  })

  it('names what is wrong', () => {
    expect(validateFeedData({ status: 'ok', value: 'Stage 1', since })).toContain('url')
    expect(validateFeedData({ status: 'ok', value: 42, url: 'https://x', since })).toContain(
      'string',
    )
    expect(
      validateFeedData({ status: 'ok', value: 'x', url: 'https://x', since, extra: { score: 1 } }),
    ).toContain('additional properties')
    expect(validateFeedData({ status: 'ok', value: 'x', url: 'https://x' })).toContain('since')
  })
})

describe('validateMetricData', () => {
  it('wants a number or null, never a string', () => {
    expect(validateMetricData({ value: 12.5, fetchedAt: since })).toBeNull()
    expect(validateMetricData({ value: null, note: 'none', fetchedAt: since })).toBeNull()
    expect(validateMetricData({ value: '12.5', fetchedAt: since })).toContain('number')
  })

  it('knows the governance bodies the governance metric stores', () => {
    const bodies = [
      { name: 'Governor', address: '0x309a', kind: 'token-vote', token: 'COMP' },
      { name: 'Risk Council', address: '0x47c7', kind: 'multisig', threshold: 2, signers: 2 },
    ]
    expect(validateMetricData({ value: 86400, fetchedAt: since, extra: { bodies } })).toBeNull()
    expect(
      validateMetricData({
        value: 86400,
        fetchedAt: since,
        extra: {
          bodies: [{ name: 'Risk Council', address: '0x47c7', kind: 'multisig', threshold: 2 }],
        },
      }),
    ).toContain('signers')
  })
})
