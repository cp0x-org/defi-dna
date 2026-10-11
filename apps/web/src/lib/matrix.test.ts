import type { Change, IndexBundle, MetricsFile, ProtocolDetail } from '@defi-dna/data'
import { describe, expect, it } from 'vitest'
import {
  EMPTY_QUERY,
  filterChips,
  matrixGroups,
  readQuery,
  writeQuery,
  type MatrixQuery,
} from './matrix.ts'
import { buildRows, type Group } from './rows.ts'

const NOW = Date.parse('2026-10-11T12:00:00.000Z')
const FETCHED = '2026-10-11T00:00:00.000Z'

/** Rows for real registry ids; every other protocol appears with no data. */
const index: IndexBundle = {
  generatedAt: FETCHED,
  rows: [
    { id: 'aave-v3', tvl: 10e9, feeds: { defiscan: true, pigi: true } },
    { id: 'aave-v4', tvl: 5e9, feeds: {} },
    { id: 'curve', tvl: 20e9, feeds: { defiscan: true } },
    { id: 'lido', tvl: null, feeds: { pigi: true } },
  ],
}
const incident = (date: string) => ({
  date,
  name: 'Example',
  amountUsd: 1,
  classification: 'Exploit',
  technique: 'Example',
  returnedFunds: null,
  source: null,
})
const metrics: MetricsFile = {
  curve: {
    incidents: {
      value: 2,
      fetchedAt: FETCHED,
      extra: { incidents: [incident('2023-07-30'), incident('2024-02-01')] },
    },
  },
  'aave-v3': { incidents: { value: 0, fetchedAt: FETCHED } },
}
const changes: Change[] = [
  {
    ts: '2026-09-01T08:00:00.000Z',
    protocolId: 'aave-v3',
    protocolName: 'Aave v3',
    feedId: 'pigi',
    from: 'C 60/100',
    to: 'C 61/100',
  },
  {
    ts: '2026-10-11T08:00:00.000Z',
    protocolId: 'lido',
    protocolName: 'Lido',
    feedId: 'pigi',
    from: null,
    to: 'B 83.64/100',
  },
]
const record = (protocolId: string, values: Record<string, string>): ProtocolDetail => ({
  protocolId,
  metrics: {},
  feeds: Object.fromEntries(
    Object.entries(values).map(([feedId, value]) => [
      feedId,
      { status: 'ok' as const, value, since: FETCHED },
    ]),
  ),
})
/** pigi's own bands: B reads as positive, D as negative; DeFiScan's counts give no reading. */
const records = new Map([
  ['aave-v3', record('aave-v3', { pigi: 'D 50.16/100', defiscan: '33 admins · 494 contracts' })],
  ['lido', record('lido', { pigi: 'B 83.64/100' })],
])
const rows = buildRows(index, { metrics, changes, records })
const query = (overrides: Partial<MatrixQuery> = {}): MatrixQuery => ({
  ...EMPTY_QUERY,
  ...overrides,
})
const names = (groups: Group[]) => groups.map((group) => group.name)
const ids = (groups: Group[]) => groups.flatMap((group) => group.rows.map((row) => row.protocol.id))

describe('buildRows', () => {
  it('joins incidents and the run log, newest first', () => {
    const curve = rows.find((row) => row.protocol.id === 'curve')
    expect(curve?.incidents).toEqual({ count: 2, latest: incident('2024-02-01') })
    expect(rows.find((row) => row.protocol.id === 'aave-v4')?.incidents).toBeNull()
    expect(rows.find((row) => row.protocol.id === 'lido')?.changes.map((c) => c.to)).toEqual([
      'B 83.64/100',
    ])
  })

  it('reads each feed on its own scale once the record is in, and only flags before', () => {
    const tones = (id: string) => rows.find((row) => row.protocol.id === id)?.tones
    expect(tones('aave-v3')).toMatchObject({ pigi: 'neg', defiscan: 'inf', philidor: 'none' })
    expect(tones('lido')).toMatchObject({ pigi: 'pos' })
    expect(tones('curve')).toMatchObject({ defiscan: 'inf', pigi: 'none' })
  })
})

describe('readQuery and writeQuery', () => {
  it('round-trip a query and leave defaults out of the URL', () => {
    const full = query({
      q: 'aave',
      categories: ['dex', 'lending'],
      tvl: '1b',
      feedsMin: 2,
      has: ['pigi'],
      missing: ['defiscan'],
      incidents: true,
      signals: ['neg', 'pos'],
      updated: '7d',
      sort: 'name-asc',
    })
    expect(readQuery(writeQuery(full))).toEqual(full)
    expect(writeQuery(query()).toString()).toBe('')
  })

  it('falls back to the defaults for unknown values in a shared link', () => {
    const stale = new URLSearchParams('sort=constructor&tvl=5m&updated=1y&has=nope&feeds=-1')
    expect(readQuery(stale)).toEqual(query())
  })
})

describe('filterChips', () => {
  it('names each active filter and knows what removing it leaves', () => {
    const chips = filterChips(query({ categories: ['dex'], has: ['pigi'] }))
    expect(chips.map((chip) => chip.label)).toEqual([
      'Category: DEX / AMM',
      'Has data from pigi.finance',
    ])
    expect(chips[1]?.without).toEqual(query({ categories: ['dex'] }))
  })
})

describe('matrixGroups', () => {
  it('nests versions, sums their TVL and puts rows without a figure last', () => {
    const groups = matrixGroups(rows, query(), NOW)
    expect(names(groups).slice(0, 2)).toEqual(['Curve', 'Aave'])
    const aave = groups.find((group) => group.name === 'Aave')
    expect(aave?.tvl).toBe(15e9)
    expect(aave?.rows.map((row) => row.protocol.id)).toEqual(['aave-v3', 'aave-v4'])
    expect(names(groups).at(-1)).not.toBe('Curve')
    expect(groups.find((group) => group.name === 'Lido')?.tvl).toBeNull()
  })

  it('filters by name, category, TVL and whether a feed has data', () => {
    expect(names(matrixGroups(rows, query({ q: ' AAVE ' }), NOW))).toEqual(['Aave'])
    expect(names(matrixGroups(rows, query({ categories: ['dex'], tvl: '1b' }), NOW))).toEqual([
      'Curve',
    ])
    expect(ids(matrixGroups(rows, query({ feedsMin: 2 }), NOW))).toEqual(['aave-v3'])
    const pigiOnly = matrixGroups(rows, query({ has: ['pigi'], missing: ['defiscan'] }), NOW)
    expect(ids(pigiOnly)).toEqual(['lido'])
  })

  it('filters and sorts on the feeds’ own readings', () => {
    expect(ids(matrixGroups(rows, query({ signals: ['neg'] }), NOW))).toEqual(['aave-v3'])
    expect(ids(matrixGroups(rows, query({ signals: ['pos'] }), NOW))).toEqual(['lido'])
    expect(names(matrixGroups(rows, query({ sort: 'signals-desc' }), NOW))[0]).toBe('Aave')
  })

  it('filters on DefiLlama incidents and on when a value last moved', () => {
    expect(ids(matrixGroups(rows, query({ incidents: true }), NOW))).toEqual(['curve'])
    expect(ids(matrixGroups(rows, query({ updated: '24h' }), NOW))).toEqual(['lido'])
    const quiet = ids(matrixGroups(rows, query({ updated: 'old' }), NOW))
    expect(quiet).toContain('aave-v3')
    expect(quiet).toContain('aave-v4')
    expect(quiet).not.toContain('lido')
  })

  it('sorts by name, coverage, last change and incidents', () => {
    const byName = names(matrixGroups(rows, query({ q: 'a', sort: 'name-asc' }), NOW))
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)))

    const byCoverage = names(matrixGroups(rows, query({ sort: 'coverage-desc' }), NOW))
    expect(byCoverage.slice(0, 3)).toEqual(['Aave', 'Curve', 'Lido'])

    const byChange = names(matrixGroups(rows, query({ sort: 'updated-desc' }), NOW))
    expect(byChange.slice(0, 2)).toEqual(['Lido', 'Aave'])

    expect(names(matrixGroups(rows, query({ sort: 'incidents-desc' }), NOW))[0]).toBe('Curve')

    const smallest = names(matrixGroups(rows, query({ sort: 'tvl-asc' }), NOW))
    expect(smallest.slice(0, 2)).toEqual(['Aave', 'Curve'])
  })
})
