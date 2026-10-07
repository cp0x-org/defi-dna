import type { IndexBundle } from '@defi-dna/data'
import { describe, expect, it } from 'vitest'
import { matrixGroups, resolveSort, selectedFeeds, type MatrixQuery } from './matrix.ts'

/** Rows for real registry ids; every other protocol appears with no data. */
const index: IndexBundle = {
  generatedAt: '2026-10-01T00:00:00.000Z',
  rows: [
    { id: 'aave-v3', tvl: 10e9, feeds: { defiscan: true, pigi: true } },
    { id: 'aave-v4', tvl: 5e9, feeds: {} },
    { id: 'curve', tvl: 20e9, feeds: { defiscan: true } },
    { id: 'lido', tvl: null, feeds: { pigi: true } },
  ],
}
const query = (overrides: Partial<MatrixQuery> = {}): MatrixQuery => ({
  q: '',
  category: '',
  tvl: '',
  coverage: '',
  sort: 'tvl',
  dir: 'desc',
  ...overrides,
})
const selected = ['defiscan', 'pigi']
const names = (groups: ReturnType<typeof matrixGroups>) => groups.map((group) => group.name)

describe('selectedFeeds', () => {
  it('shows one pinned feed, else everything not hidden', () => {
    expect(selectedFeeds(['a', 'b', 'c'], ['b'], '')).toEqual(['a', 'c'])
    expect(selectedFeeds(['a', 'b', 'c'], ['b'], 'b')).toEqual(['b'])
    expect(selectedFeeds(['a', 'b'], [], 'nope')).toEqual(['a', 'b'])
  })
})

describe('resolveSort', () => {
  it('defaults to TVL, biggest first, and names A–Z', () => {
    expect(resolveSort(null, null, selected)).toEqual({ sort: 'tvl', dir: 'desc' })
    expect(resolveSort('name', null, selected)).toEqual({ sort: 'name', dir: 'asc' })
    expect(resolveSort('name', 'desc', selected)).toEqual({ sort: 'name', dir: 'desc' })
  })

  it('falls back to TVL when the URL sorts by a feed that is not on show', () => {
    expect(resolveSort('feed:pigi', 'asc', ['defiscan'])).toEqual({ sort: 'tvl', dir: 'asc' })
    expect(resolveSort('feed:pigi', null, selected)).toEqual({ sort: 'feed:pigi', dir: 'desc' })
  })
})

describe('matrixGroups', () => {
  it('nests versions, sums their TVL and puts rows without a figure last', () => {
    const groups = matrixGroups(index, query(), selected)
    expect(names(groups).slice(0, 2)).toEqual(['Curve', 'Aave'])
    const aave = groups.find((group) => group.name === 'Aave')
    expect(aave?.tvl).toBe(15e9)
    expect(aave?.rows.map((row) => row.protocol.id)).toEqual(['aave-v3', 'aave-v4'])
    expect(names(groups).at(-1)).not.toBe('Curve')
    expect(groups.find((group) => group.name === 'Lido')?.tvl).toBeNull()
  })

  it('filters by name, category, TVL band and coverage', () => {
    expect(names(matrixGroups(index, query({ q: ' AAVE ' }), selected))).toEqual(['Aave'])
    expect(names(matrixGroups(index, query({ category: 'dex', tvl: '1b' }), selected))).toEqual([
      'Curve',
    ])
    const full = matrixGroups(index, query({ coverage: 'full' }), selected)
    expect(full.flatMap((group) => group.rows.map((row) => row.protocol.id))).toEqual(['aave-v3'])
    // Only the feeds on show count: with pigi hidden, Curve is fully covered too.
    const onlyDefiscan = matrixGroups(index, query({ coverage: 'full' }), ['defiscan'])
    expect(onlyDefiscan.flatMap((group) => group.rows.map((row) => row.protocol.id))).toEqual([
      'curve',
      'aave-v3',
    ])
  })

  it('sorts by name, by coverage and by one feed, in either direction', () => {
    const byName = matrixGroups(index, query({ q: 'a', sort: 'name', dir: 'asc' }), selected)
    expect(names(byName)).toEqual([...names(byName)].sort((a, b) => a.localeCompare(b)))

    const byCoverage = matrixGroups(index, query({ sort: 'coverage', dir: 'desc' }), selected)
    expect(names(byCoverage)[0]).toBe('Aave') // two feeds, the most
    expect(names(byCoverage)[1]).toBe('Curve')

    const byPigi = matrixGroups(index, query({ sort: 'feed:pigi', dir: 'desc' }), selected)
    expect(names(byPigi).slice(0, 2)).toEqual(['Aave', 'Lido'])
    const byPigiAsc = matrixGroups(index, query({ sort: 'feed:pigi', dir: 'asc' }), selected)
    expect(names(byPigiAsc).slice(-2)).toEqual(['Aave', 'Lido'])
  })
})
