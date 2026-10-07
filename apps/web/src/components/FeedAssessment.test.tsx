import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Feed, FeedData } from '@defi-dna/data'
import { FeedAssessment } from './FeedAssessment.tsx'

const feed: Feed = {
  id: 'example',
  name: 'Example Feed',
  topic: 'Vault risk',
  focus: 'Grades vaults.',
  assesses: 'vault',
  homepage: 'https://example.com',
  enabled: true,
}

describe('FeedAssessment', () => {
  it('shows the raw record and the assessed object behind a card with data', () => {
    const data: FeedData = {
      status: 'ok',
      value: 'Stage 1',
      url: 'https://example.com/protocol',
      fetchedAt: '2026-10-01T00:00:00.000Z',
    }
    const html = renderToStaticMarkup(<FeedAssessment feed={feed} data={data} />)
    expect(html).toContain('assesses individual vaults, not the protocol')
    expect(html).toContain('Raw record')
    expect(html).toContain('&quot;value&quot;: &quot;Stage 1&quot;')
  })

  it('shows the raw record behind an empty card too', () => {
    const data: FeedData = {
      status: 'none',
      note: 'Nothing mapped.',
      fetchedAt: '2026-10-01T00:00:00.000Z',
    }
    const html = renderToStaticMarkup(<FeedAssessment feed={feed} data={data} />)
    expect(html).toContain('No data in this feed')
    expect(html).toContain('Raw record')
    expect(html).toContain('&quot;status&quot;: &quot;none&quot;')
  })
})
