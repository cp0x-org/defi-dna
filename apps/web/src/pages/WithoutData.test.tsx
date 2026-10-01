import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { feeds } from '../lib/registry.ts'
import { MatrixPage } from './MatrixPage.tsx'
import { MethodologyPage } from './MethodologyPage.tsx'
import { SourcesPage } from './SourcesPage.tsx'

const render = (page: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{page}</MemoryRouter>)

describe('pages without the dataset', () => {
  it('keeps the matrix structure and says why its body is empty', () => {
    const html = render(<MatrixPage index={null} error="404 while loading index.json" />)
    expect(html).toContain('The dataset could not be loaded')
    expect(html).toContain('no risk found')
    for (const feed of feeds) expect(html).toContain(feed.name)
    expect(html).not.toContain('group-row')
    expect(html).not.toContain('No matching protocols')
  })

  it('shows a loading state while the dataset is on its way', () => {
    const html = render(<MatrixPage index={null} error={null} />)
    expect(html).toContain('Loading the latest collected data')
    expect(html).not.toContain('could not be loaded')
  })

  it('renders the hand-maintained pages with coverage left blank', () => {
    const sources = render(<SourcesPage index={null} />)
    for (const feed of feeds) expect(sources).toContain(feed.focus)
    expect(sources).toContain('Not loaded')

    const methodology = render(<MethodologyPage index={null} />)
    for (const feed of feeds) expect(methodology).toContain(feed.name)
  })
})
