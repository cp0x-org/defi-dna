import type { Change } from '@defi-dna/data'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { feeds } from '../../shared/lib/registry.ts'
import type { Row } from './rows.ts'
import { PopCard } from './PopCard.tsx'
import { VersionRow } from './VersionRow.tsx'

const NOW = Date.parse('2026-10-11T12:00:00.000Z')
const feedId = feeds[0]?.id ?? 'pigi'
const change: Change = {
  ts: '2026-10-11T10:00:00.000Z',
  protocolId: 'curve',
  protocolName: 'Curve',
  feedId,
  from: null,
  to: 'B',
}
const row: Row = {
  protocol: { id: 'curve', name: 'Curve', category: 'dex' },
  tvl: 2e9,
  governance: {
    delay: 172800,
    multisigs: [{ name: 'Emergency DAO', address: '0x467947ee', threshold: 5, signers: 9 }],
  },
  feeds: { [feedId]: true },
  tones: { [feedId]: 'inf' },
  incidents: null,
  changes: [change],
}

describe('dashboard rows and cards', () => {
  it('renders a version with the changes from the last 24 hours', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <table>
          <tbody>
            <VersionRow
              row={row}
              nested={false}
              now={NOW}
              noChangeTitle="No change"
              noIncidentsTitle="Not collected"
              noGovernanceTitle="Nothing read"
              popTarget={() => ({
                onMouseEnter: () => {},
                onMouseLeave: () => {},
                onClick: () => {},
              })}
              show={() => true}
            />
          </tbody>
        </table>
      </MemoryRouter>,
    )
    expect(html).toContain('Curve')
    expect(html).toContain('NEW · 1')
    expect(html).toContain(`1 of ${feeds.length} feeds have data`)
    // Governance as the contracts report it: the delay in words and seconds, each multisig as a ratio.
    expect(html).toContain('2 days')
    expect(html).toContain('172,800 s')
    expect(html).toContain('5 of 9')
    expect(html).toContain('Emergency DAO')
  })

  it('leaves out the columns the visitor hid, and the protocol column never', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <table>
          <tbody>
            <VersionRow
              row={row}
              nested={false}
              now={NOW}
              noChangeTitle="No change"
              noIncidentsTitle="Not collected"
              noGovernanceTitle="Nothing read"
              popTarget={() => ({
                onMouseEnter: () => {},
                onMouseLeave: () => {},
                onClick: () => {},
              })}
              show={(key) => key !== 'multisigs' && key !== 'tvl'}
            />
          </tbody>
        </table>
      </MemoryRouter>,
    )
    expect(html).toContain('Curve')
    expect(html).toContain('172,800 s')
    expect(html).not.toContain('Emergency DAO')
    expect(html).not.toContain('Ethereum</small>')
  })

  it('lists every feed in the coverage card and the move in the changes card', () => {
    const render = (kind: 'coverage' | 'changes') =>
      renderToStaticMarkup(
        <MemoryRouter>
          <PopCard kind={kind} row={row} pinned={false} now={NOW} onClose={() => {}} />
        </MemoryRouter>,
      )
    const coverage = render('coverage')
    for (const feed of feeds) expect(coverage).toContain(feed.name)
    expect(render('changes')).toContain('published a first value')
  })
})
