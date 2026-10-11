import { fakeContext } from '@defi-dna/core/testing'
import { describe, expect, it } from 'vitest'
import aave from './fixtures/aave.json' with { type: 'json' }
import protocols from './fixtures/protocols.json' with { type: 'json' }
import adapter from './index.ts'

/**
 * The pattern every adapter test follows.
 *
 * `fixtures/` holds real responses, trimmed to a few entries: copy the `body`
 * of the matching .cache/http/<sha>.json after one online run. Keep the values
 * real; never invent a rating or a date. `fakeContext` serves them by URL
 * (`POST <url>` for postJson, `null` for a 404), refuses any other URL, and
 * runs a request's `headers` function as the network would. Then prepare()
 * once and collect() for the three answers a feed can give.
 */
const API = 'https://example.com/api'
const responses = { [`${API}/protocols`]: protocols, [`${API}/protocols/aave`]: aave }
const mapping = { 'aave-v3': ['aave'], curve: ['curve'] }
const aaveV3 = { id: 'aave-v3', name: 'Aave v3', category: 'lending' }

describe('template adapter', () => {
  it('returns the value verbatim, with the breakdown, the date, the link and the facts', async () => {
    const ctx = fakeContext(responses, { mapping })
    const prepared = await adapter.prepare!(ctx)
    const result = await adapter.collect({ protocol: aaveV3, ctx, prepared })
    expect(result).toMatchObject({
      value: 'A',
      summary: aave.text,
      updatedAt: '2026-09-15',
      url: 'https://example.com/protocol/aave',
      note: 'The feed files Aave v3 as "aave".',
      extra: { facts: [{ name: 'Filed under', value: 'aave' }] },
    })
    expect(result?.details).toEqual([
      { name: 'Governance', value: 'Low', description: 'A timelock guards every upgrade.' },
      { name: 'Oracle', value: 'Medium' },
    ])
    expect(ctx.requests).toEqual([`${API}/protocols`, `${API}/protocols/aave`])
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

  // A key-protected feed: vi.stubEnv('EXAMPLE_API_KEY', 'test') in the test, serve
  // `POST ${API}/auth/token` → { token: 't' }, and assert ctx.requests shows one mint.
})
