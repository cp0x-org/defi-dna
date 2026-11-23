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
    bodies: [
      { name: 'DAO', address: '0x40907540', kind: 'token-vote', token: 'veCRV' },
      { name: 'Emergency DAO', address: '0x467947ee', kind: 'multisig', threshold: 5, signers: 9 },
    ],
    facts: [
      { name: 'Ownership admin delay', value: '172800 s (2 days)' },
      { name: 'Ownership admin', value: '0x40907540d8a6C65c637785e8f8B742ae6b0b9968' },
      { name: 'Emergency DAO', value: '5 of 9 signers' },
    ],
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
    for (const feed of feeds) expect(html).toContain(`${feed.name} ·`)
    // Governance as the contracts report it: the delay in words, the seconds behind it, each body by what it is.
    expect(html).toContain('2 days')
    expect(html).toContain('title="172,800 seconds"')
    expect(html).toContain('Token vote')
    expect(html).toContain('veCRV · DAO')
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
              noIncidentsTitle="Not collected"
              noGovernanceTitle="Nothing read"
              popTarget={() => ({
                onMouseEnter: () => {},
                onMouseLeave: () => {},
                onClick: () => {},
              })}
              show={(key) => key !== 'governance' && key !== 'tvl'}
            />
          </tbody>
        </table>
      </MemoryRouter>,
    )
    expect(html).toContain('Curve')
    expect(html).toContain('2 days')
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

  it('lists the readings behind the timelock figure, addresses left to the tab', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PopCard kind="timelock" row={row} pinned={false} now={NOW} onClose={() => {}} />
      </MemoryRouter>,
    )
    expect(html).toContain('Governance timelock · Curve')
    expect(html).toContain('172,800 seconds between scheduling and execution')
    expect(html).toContain('<dt>Ownership admin delay</dt>')
    expect(html).toContain('5 of 9 signers')
    expect(html).not.toContain('0x40907540d8a6C65c637785e8f8B742ae6b0b9968')
    expect(html).toContain('href="/protocol/curve/governance"')
  })

  it('opens incidents on the incidents block', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PopCard kind="incidents" row={row} pinned={false} now={NOW} onClose={() => {}} />
      </MemoryRouter>,
    )
    expect(html).toContain('href="/protocol/curve/governance#incidents"')
  })
})
