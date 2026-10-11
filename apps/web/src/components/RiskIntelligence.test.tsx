import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Feed, FeedData, Protocol } from '@defi-dna/data'
import { FeedSource } from './RiskIntelligence.tsx'

const feed: Feed = {
  id: 'example',
  name: 'Example Feed',
  topic: 'Vault risk',
  focus: 'Grades vaults.',
  assesses: 'vault',
  homepage: 'https://example.com',
  enabled: true,
}
const protocol: Protocol = { id: 'example-v1', name: 'Example v1', category: 'lending' }
const render = (data?: FeedData) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <FeedSource feed={feed} data={data} protocol={protocol} />
    </MemoryRouter>,
  )

describe('FeedSource', () => {
  it('names the assessed object and prints no stored JSON', () => {
    const html = render({
      status: 'ok',
      value: 'Stage 1',
      url: 'https://example.com/protocol',
      since: '2026-10-01T00:00:00.000Z',
    })
    expect(html).toContain('individual vaults, not the protocol')
    expect(html).toContain('Stage 1')
    // The record is public in the data repository; the page never reprints it.
    expect(html).not.toContain('&quot;value&quot;')
    expect(html).not.toContain('<pre')
  })

  it('shows the feed’s explanation of a term next to it', () => {
    const html = render({
      status: 'ok',
      value: 'B 82.23/100',
      details: [
        { name: 'Node rating', value: '80/100', description: 'The node’s own rating.' },
        { name: 'Weights', value: 'node 0.6 · vaults 0.4' },
      ],
      since: '2026-10-01T00:00:00.000Z',
    })
    expect(html).toContain('Node rating')
    expect(html).toContain('The node’s own rating.')
    expect(html).toContain('node 0.6 · vaults 0.4')
  })

  it('names the rule next to a colour, and says so when the scale gives none', () => {
    const graded: Feed = {
      ...feed,
      status: {
        rule: 'Example grades A to C, A best, as its methodology describes.',
        match: '^([A-C])',
        values: { a: 'positive', b: 'neutral', c: 'negative' },
      },
    }
    const coloured = renderToStaticMarkup(
      <MemoryRouter>
        <FeedSource
          feed={graded}
          protocol={protocol}
          data={{ status: 'ok', value: 'C 12/100', since: '2026-10-01T00:00:00Z' }}
        />
      </MemoryRouter>,
    )
    expect(coloured).toContain('pill st-neg')
    expect(coloured).toContain('Example grades A to C')

    const plain = render({ status: 'ok', value: '46 vaults rated', since: '2026-10-01T00:00:00Z' })
    expect(plain).toContain('pill st-inf')
    expect(plain).toContain('No status colour')
  })

  it('explains an empty feed as a gap, and a failed read as ours', () => {
    const none = render({ status: 'none', note: 'Nothing mapped.', since: '2026-10-01T00:00:00Z' })
    expect(none).toContain('has not published anything we could map to Example v1')
    expect(none).toContain('No data is not a signal')
    expect(none).toContain('Nothing mapped.')
    expect(none).not.toContain('&quot;status&quot;')

    const failed = render({ status: 'error', since: '2026-10-01T00:00:00Z' })
    expect(failed).toContain('We could not read Example Feed')
    expect(failed).toContain('This is our failure')
  })
})
