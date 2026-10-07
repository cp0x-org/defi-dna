import { fakeContext } from '@defi-dna/core/testing'
import { describe, expect, it } from 'vitest'
import aave from './fixtures/aave.json' with { type: 'json' }
import protocols from './fixtures/protocols.json' with { type: 'json' }
import adapter from './index.ts'

/**
 * The pattern every adapter test follows: canned responses (trimmed real ones,
 * copied from .cache/http), the mapping the test needs, prepare() once, then
 * collect() for the three answers a feed can give.
 */
const API = 'https://example.com/api'
const responses = { [`${API}/protocols`]: protocols, [`${API}/protocols/aave`]: aave }
const mapping = { 'aave-v3': ['aave'], curve: ['curve'] }

describe('template adapter', () => {
  it('returns the value verbatim, with the breakdown, the date and the link', async () => {
    const ctx = fakeContext(responses, { mapping })
    const prepared = await adapter.prepare!(ctx)
    const result = await adapter.collect({
      protocol: { id: 'aave-v3', name: 'Aave v3', category: 'lending' },
      ctx,
      prepared,
    })
    expect(result).toMatchObject({
      value: 'A',
      summary: aave.text,
      updatedAt: '2026-09-15',
      url: 'https://example.com/protocol/aave',
    })
    expect(result?.details).toEqual([
      { name: 'Governance', value: 'Low', description: 'A timelock guards every upgrade.' },
      { name: 'Oracle', value: 'Medium' },
    ])
  })

  it('reports a listed protocol without an assessment as a note, and an unmapped one as null', async () => {
    const ctx = fakeContext(responses, { mapping })
    const prepared = await adapter.prepare!(fakeContext({ [`${API}/protocols`]: [{ id: 'aave' }] }))
    const listed = await adapter.collect({
      protocol: { id: 'curve', name: 'Curve', category: 'dex' },
      ctx,
      prepared,
    })
    expect(listed?.value).toBeUndefined()
    expect(listed?.note).toContain('no assessment')
    await expect(
      adapter.collect({ protocol: { id: 'lido', name: 'Lido', category: 'x' }, ctx, prepared }),
    ).resolves.toBeNull()
  })
})
