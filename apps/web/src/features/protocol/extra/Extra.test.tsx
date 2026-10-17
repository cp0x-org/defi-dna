import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FeedExtras, hasFeedExtras } from './FeedExtras.tsx'
import { IncidentsExtra, TvlComponentsExtra } from './MetricExtras.tsx'
import { TextExtra } from './TextExtra.tsx'

describe('optional extra views', () => {
  it('renders only the shapes present in the record', () => {
    const extra = {
      reviews: [
        {
          file: 'ethereum.md',
          stage: 'Stage 1',
          risks: ['L'],
          date: null,
          url: 'https://example.com/review',
        },
      ],
      text: ['A source-supplied note.'],
    }

    expect(hasFeedExtras(extra)).toBe(true)
    const html = renderToStaticMarkup(<FeedExtras extra={extra} feedName="DeFiScan" />)
    expect(html).toContain('DeFiScan reviews')
    expect(html).toContain('ethereum.md')
    expect(html).toContain('A source-supplied note.')
    expect(html).not.toContain('As filed by')
    expect(html).not.toContain('Vaults (')
    expect(renderToStaticMarkup(<FeedExtras feedName="DeFiScan" />)).toBe('')
  })

  it('renders facts, findings and vault data from their shapes', () => {
    const analysis = renderToStaticMarkup(
      <FeedExtras
        feedName="Risklayer"
        extra={{
          facts: [
            { name: 'Analyzed domain', value: 'example.org' },
            { name: 'Risk level', value: 'medium' },
          ],
          findings: [
            { title: 'Oracle risk', severity: 'high', category: 'Oracle', description: 'Details' },
          ],
        }}
      />,
    )
    expect(analysis).toContain('As filed by Risklayer')
    expect(analysis).toContain('example.org')
    expect(analysis).toContain('Oracle risk')
    expect(analysis).toContain('Oracle')
    expect(analysis).not.toContain('Vaults (')

    const vaults = renderToStaticMarkup(
      <FeedExtras
        feedName="Philidor"
        extra={{
          facts: [{ name: 'Vaults rated', value: '1' }],
          vaults: [
            {
              name: 'Example vault',
              version: 'v1',
              curator: null,
              tier: 'low',
              score: 75,
              tvlUsd: 1200,
              scoredAt: null,
              url: 'https://example.com/vault',
            },
          ],
        }}
      />,
    )
    expect(vaults).toContain('As filed by Philidor')
    expect(vaults).toContain('Vaults (1)')
    expect(vaults).toContain('Example vault')
    expect(vaults).not.toContain('Findings reported')
  })

  it('renders each metric extra only when its JSON field exists', () => {
    const tvl = renderToStaticMarkup(
      <TvlComponentsExtra components={[{ id: '42', name: 'Example', tvl: 1200 }]} />,
    )
    expect(tvl).toContain('DefiLlama TVL components')
    expect(tvl).toContain('Example')
    expect(renderToStaticMarkup(<TvlComponentsExtra />)).toBe('')

    const incidents = renderToStaticMarkup(
      <IncidentsExtra
        incidents={[
          {
            date: '2026-01-01',
            name: 'Incident',
            amountUsd: 100,
            classification: 'Exploit',
            technique: 'Oracle',
            returnedFunds: 50,
            source: 'https://example.com/report',
          },
        ]}
      />,
    )
    expect(incidents).toContain('Incident')
    expect(incidents).toContain('Report')
    expect(renderToStaticMarkup(<IncidentsExtra />)).toBe('')
    expect(renderToStaticMarkup(<IncidentsExtra incidents={[]} />)).toContain(
      'DefiLlama records no incident',
    )
    expect(renderToStaticMarkup(<TextExtra />)).toBe('')
  })
})
