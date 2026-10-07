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
  it('names the assessed object and prints no stored JSON on a card with data', () => {
    const data: FeedData = {
      status: 'ok',
      value: 'Stage 1',
      url: 'https://example.com/protocol',
      since: '2026-10-01T00:00:00.000Z',
    }
    const html = renderToStaticMarkup(<FeedAssessment feed={feed} data={data} />)
    expect(html).toContain('assesses individual vaults, not the protocol')
    // The record is public in the data repository; the page never reprints it.
    expect(html).not.toContain('&quot;value&quot;')
  })

  it('puts a help button next to a previewed term that the feed explains', () => {
    const data: FeedData = {
      status: 'ok',
      value: 'B 82.23/100',
      details: [
        { name: 'Node rating', value: '80/100', description: 'The node’s own rating.' },
        { name: 'Weights', value: 'node 0.6 · vaults 0.4' },
      ],
      url: 'https://example.com/protocol',
      since: '2026-10-01T00:00:00.000Z',
    }
    const preview = renderToStaticMarkup(<FeedAssessment feed={feed} data={data} />).split(
      'assessment-details',
    )[0]
    expect(preview).toContain('aria-label="Node rating"')
    expect(preview).not.toContain('aria-label="Weights"')
  })

  it('explains an empty card without printing its stored JSON', () => {
    const data: FeedData = {
      status: 'none',
      note: 'Nothing mapped.',
      since: '2026-10-01T00:00:00.000Z',
    }
    const html = renderToStaticMarkup(<FeedAssessment feed={feed} data={data} />)
    expect(html).toContain('No data in this feed')
    expect(html).not.toContain('&quot;status&quot;')
  })
})
