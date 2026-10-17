import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LoadState } from '../shared/ui/LoadState.tsx'
import { readQuery } from '../features/dashboard/matrix.ts'
import { feeds } from '../shared/lib/registry.ts'
import { DashboardPage, DataGaps } from '../features/dashboard/DashboardPage.tsx'
import { MethodologyPage } from '../features/reading/MethodologyPage.tsx'
import { ProtocolPage } from '../features/protocol/ProtocolPage.tsx'
import { SourcesPage } from '../features/reading/SourcesPage.tsx'

const render = (page: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{page}</MemoryRouter>)
const retry = () => {}

describe('pages without the dataset', () => {
  it('keeps the dashboard structure and says why its body is empty', () => {
    const html = render(
      <DashboardPage index={null} error="404 while loading index.json" onRetry={retry} />,
    )
    expect(html).toContain('The dataset could not be loaded')
    expect(html).toContain('no risk found')
    for (const feed of feeds) expect(html).toContain(feed.name)
    expect(html).not.toContain('group-row')
    expect(html).not.toContain('No protocol versions match')
  })

  it('shows a loading state while the dataset is on its way', () => {
    const html = render(<DashboardPage index={null} error={null} onRetry={retry} />)
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

describe('the feeds page', () => {
  it('links each feed to the dashboard filtered to versions it has data for', () => {
    const html = render(<SourcesPage index={null} />)
    const links = [...html.matchAll(/href="\/\?([^"]*)"[^>]*>See this column/g)].map(([, search]) =>
      readQuery(new URLSearchParams(search?.replaceAll('&amp;', '&'))),
    )
    expect(links.map((query) => query.has)).toEqual(feeds.map((feed) => [feed.id]))
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
        onRetry={retry}
      />,
    )
    expect(html).toContain('Curve')
    expect(html).toContain(`aria-label="1 of ${feeds.length} feeds have data`)
    expect(html).not.toContain('Loading the latest collected data')
  })

  it('says which side files failed, and stays silent when none did', () => {
    const both = render(<DataGaps metricsError="500" changelogError="404" onRetry={retry} />)
    expect(both).toContain('incident figures could not be loaded')
    expect(both).toContain('The run log could not be loaded')
    expect(both).toContain('Try again')

    const metricsOnly = render(
      <DataGaps metricsError="500" changelogError={null} onRetry={retry} />,
    )
    expect(metricsOnly).not.toContain('run log')

    expect(render(<DataGaps metricsError={null} changelogError={null} onRetry={retry} />)).toBe('')
  })
})

describe('LoadState', () => {
  it('names a failure, offers a retry and keeps the technical details folded', () => {
    const html = render(
      <LoadState error="503 while loading changelog.json" onRetry={retry} failed="Log failed">
        Nothing is listed until it is.
      </LoadState>,
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('<h3>Log failed</h3>')
    expect(html).toContain('Nothing is listed until it is.')
    expect(html).toContain('Try again')
    expect(html).toMatch(/<details>.*503 while loading changelog\.json.*<\/details>/)
  })

  it('shows only the loading line while waiting, with its heading when given one', () => {
    const bare = render(<LoadState error={null} onRetry={retry} failed="Log failed" />)
    expect(bare).toContain('role="status"')
    expect(bare).not.toContain('<h3>')
    expect(bare).not.toContain('Log failed')

    const titled = render(
      <LoadState error={null} onRetry={retry} failed="Log failed" loading="Loading the log…" />,
    )
    expect(titled).toContain('<h3>Loading the log…</h3>')
  })
})
