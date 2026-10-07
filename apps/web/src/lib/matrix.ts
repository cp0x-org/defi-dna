import type { IndexBundle } from '@defi-dna/data'
import { dataCount, groupRows, type Group } from './rows.ts'
import { TVL_BANDS } from './view.ts'

export type Dir = 'asc' | 'desc'

/** What the matrix is asked to show. All of it comes from the URL. */
export interface MatrixQuery {
  /** Free text matched against the protocol and group names. */
  q: string
  category: string
  /** A key of TVL_BANDS, or empty. */
  tvl: string
  /** `full`, `partial`, or empty. */
  coverage: string
  /** `name`, `tvl`, `coverage` or `feed:<id>`. */
  sort: string
  dir: Dir
}

/** Names sort A–Z by default; everything else biggest first. */
export const defaultDir = (key: string): Dir => (key === 'name' ? 'asc' : 'desc')

/** The feed columns on show: one feed pinned by the URL, else everything the visitor did not hide. */
export const selectedFeeds = (feedIds: string[], hidden: string[], pinned: string): string[] =>
  feedIds.includes(pinned) ? [pinned] : feedIds.filter((id) => !hidden.includes(id))

/** The sort the URL asks for — or TVL when it names a feed that is not on show. */
export function resolveSort(
  requested: string | null,
  direction: string | null,
  selectedIds: string[],
): { sort: string; dir: Dir } {
  const wanted = requested ?? 'tvl'
  const sort = wanted.startsWith('feed:') && !selectedIds.includes(wanted.slice(5)) ? 'tvl' : wanted
  const dir: Dir = direction === 'asc' ? 'asc' : direction === 'desc' ? 'desc' : defaultDir(sort)
  return { sort, dir }
}

/**
 * Filter the rows, nest them by protocol and order the groups. Pure: the same
 * index and query always give the same table. The default order is TVL, a
 * measured quantity — never anything that reads as a risk ranking.
 */
export function matrixGroups(
  index: IndexBundle,
  query: MatrixQuery,
  selectedIds: string[],
): Group[] {
  const band = TVL_BANDS[query.tvl]
  const needle = query.q.trim().toLowerCase()
  const filtered = groupRows(index, (row) => {
    const { protocol } = row
    const name = `${protocol.group ?? ''} ${protocol.name}`.toLowerCase()
    if (needle && !name.includes(needle)) return false
    if (query.category && protocol.category !== query.category) return false
    if (band && (row.tvl == null || row.tvl < band.min || row.tvl >= band.max)) return false
    // Coverage counts only the feeds on show: a hidden feed cannot leave a gap.
    if (query.coverage && selectedIds.length) {
      const full = dataCount(row.feeds, selectedIds) === selectedIds.length
      if (query.coverage === 'full' ? !full : full) return false
    }
    return true
  })

  const rank = (group: Group): number | null => {
    if (query.sort.startsWith('feed:')) return group.feeds[query.sort.slice(5)] ? 1 : 0
    if (query.sort === 'coverage') return dataCount(group.feeds, selectedIds)
    return group.tvl
  }
  return filtered.sort((a, b) => {
    if (query.sort === 'name') {
      return query.dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    }
    const [rankA, rankB] = [rank(a), rank(b)]
    if (rankA == null || rankB == null) {
      return rankA == null && rankB == null ? a.name.localeCompare(b.name) : rankA == null ? 1 : -1
    }
    return (query.dir === 'desc' ? rankB - rankA : rankA - rankB) || a.name.localeCompare(b.name)
  })
}
