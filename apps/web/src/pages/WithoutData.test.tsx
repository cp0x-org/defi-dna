import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { feeds } from '../lib/registry.ts'
import { DashboardPage } from './DashboardPage.tsx'
import { MethodologyPage } from './MethodologyPage.tsx'
import { ProtocolPage } from './ProtocolPage.tsx'
import { SourcesPage } from './SourcesPage.tsx'

const render = (page: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{page}</MemoryRouter>)

describe('pages without the dataset', () => {
  it('keeps the dashboard structure and says why its body is empty', () => {
    const html = render(<DashboardPage index={null} error="404 while loading index.json" />)
    expect(html).toContain('The dataset could not be loaded')
    expect(html).toContain('no risk found')
    for (const feed of feeds) expect(html).toContain(feed.name)
    expect(html).not.toContain('group-row')
    expect(html).not.toContain('No protocol versions match')
  })

  it('shows a loading state while the dataset is on its way', () => {
    const html = render(<DashboardPage index={null} error={null} />)
    expect(html).toContain('Loading the latest collected data')
    expect(html).not.toContain('could not be loaded')
  })

  it('renders a protocol heading and its tabs from the registry alone', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/protocol/aave-v3/risk']}>
        <Routes>
          <Route path="/protocol/:id/:tab?/:feed?" element={<ProtocolPage index={null} />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Aave v3')
    expect(html).toContain('Loading what the feeds publish')
    expect(html).toMatch(/aria-current="page"[^>]*>Risk intelligence/)
  })

  it('renders the hand-maintained pages with coverage left blank', () => {
    const sources = render(<SourcesPage index={null} />)
    for (const feed of feeds) expect(sources).toContain(feed.focus)
    expect(sources).toContain('Not loaded')

    const methodology = render(<MethodologyPage index={null} />)
    for (const feed of feeds) expect(methodology).toContain(feed.name)
  })
})

describe('the dashboard with the dataset', () => {
  it('shows whether feeds have data and never a feed’s value', () => {
    const html = render(
      <DashboardPage
        index={{
          generatedAt: '2026-10-11T00:00:00.000Z',
          rows: [{ id: 'curve', tvl: 2e9, feeds: { [feeds[0]?.id ?? '']: true } }],
        }}
        error={null}
      />,
    )
    expect(html).toContain('Curve')
    expect(html).toContain(`aria-label="1 of ${feeds.length} feeds have data`)
    expect(html).not.toContain('Loading the latest collected data')
  })
})
