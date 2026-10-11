import { feeds } from './registry.ts'
import { changedAt, dataCount, groupRows, type Group, type Row } from './rows.ts'
import { SIGNAL_LABELS, signalCounts, type Signal } from './status.ts'
import { categoryLabel } from './view.ts'

const DAY = 86_400_000

/**
 * The orders a visitor can pick. The default is TVL, a measured quantity —
 * never anything that reads as a risk ranking. Coverage and incident counts are
 * facts too, but sorting by them is a deliberate choice, not where the table starts.
 */
export const SORTS = {
  'tvl-desc': 'TVL · high to low',
  'tvl-asc': 'TVL · low to high',
  'name-asc': 'Name · A–Z',
  'coverage-desc': 'Feed coverage · most first',
  'updated-desc': 'Recently changed',
  'incidents-desc': 'Incidents · most first',
  'signals-desc': 'Negative feed signals · most first',
} as const
export type SortKey = keyof typeof SORTS

export const TVL_MIN: Record<string, { label: string; min: number }> = {
  '10m': { label: '> $10M', min: 1e7 },
  '100m': { label: '> $100M', min: 1e8 },
  '1b': { label: '> $1B', min: 1e9 },
}

/** How recently a feed's value moved, per our run log. `old` includes versions with no move logged. */
export const UPDATED: Record<string, { label: string; chip: string; days: number }> = {
  '24h': { label: '24 hours', chip: 'Changed ≤ 24h', days: 1 },
  '7d': { label: '7 days', chip: 'Changed ≤ 7d', days: 7 },
  '30d': { label: '30 days', chip: 'Changed ≤ 30d', days: 30 },
  old: { label: 'Not in 30 days', chip: 'No change in 30d', days: 30 },
}

/** What the dashboard is asked to show. All of it comes from the URL, so a view can be shared. */
export interface MatrixQuery {
  /** Free text matched against names, ids and categories. */
  q: string
  categories: string[]
  /** A key of TVL_MIN, or empty. */
  tvl: string
  /** Minimum number of feeds with data; 0 for any. */
  feedsMin: number
  /** Feeds that must have data, and feeds that must have none. Never what they say. */
  has: string[]
  missing: string[]
  incidents: boolean
  /** Signal groups a version must have at least one feed in. */
  signals: Signal[]
  /** A key of UPDATED, or empty. */
  updated: string
  sort: SortKey
}

export const EMPTY_QUERY: MatrixQuery = {
  q: '',
  categories: [],
  tvl: '',
  feedsMin: 0,
  has: [],
  missing: [],
  incidents: false,
  signals: [],
  updated: '',
  sort: 'tvl-desc',
}

const list = (value: string | null): string[] => (value ? value.split(',').filter(Boolean) : [])
const known = (table: object, key: string): boolean => Object.hasOwn(table, key)

/** Unknown or stale values in a shared link fall back to the default instead of emptying the table. */
export function readQuery(params: URLSearchParams): MatrixQuery {
  const feedIds = feeds.map((feed) => feed.id)
  const sort = params.get('sort') ?? ''
  const tvl = params.get('tvl') ?? ''
  const updated = params.get('updated') ?? ''
  const feedsMin = Number(params.get('feeds'))
  return {
    q: params.get('q') ?? '',
    categories: list(params.get('category')),
    tvl: known(TVL_MIN, tvl) ? tvl : '',
    feedsMin: Number.isInteger(feedsMin) && feedsMin > 0 ? Math.min(feedsMin, feedIds.length) : 0,
    has: list(params.get('has')).filter((id) => feedIds.includes(id)),
    missing: list(params.get('missing')).filter((id) => feedIds.includes(id)),
    incidents: params.get('incidents') === '1',
    signals: list(params.get('signals')).filter((signal): signal is Signal =>
      known(SIGNAL_LABELS, signal),
    ),
    updated: known(UPDATED, updated) ? updated : '',
    sort: known(SORTS, sort) ? (sort as SortKey) : EMPTY_QUERY.sort,
  }
}

/** The shortest URL for a query: defaults are left out. */
export function writeQuery(query: MatrixQuery): URLSearchParams {
  const params = new URLSearchParams()
  const set = (key: string, value: string) => {
    if (value) params.set(key, value)
  }
  set('q', query.q)
  set('category', query.categories.join(','))
  set('tvl', query.tvl)
  set('feeds', query.feedsMin ? String(query.feedsMin) : '')
  set('has', query.has.join(','))
  set('missing', query.missing.join(','))
  set('incidents', query.incidents ? '1' : '')
  set('signals', query.signals.join(','))
  set('updated', query.updated)
  set('sort', query.sort === EMPTY_QUERY.sort ? '' : query.sort)
  return params
}

/** One chip per active filter, each carrying the query that is left once it is removed. */
export function filterChips(query: MatrixQuery): { label: string; without: MatrixQuery }[] {
  const name = (id: string) => feeds.find((feed) => feed.id === id)?.name ?? id
  const drop = (values: string[], value: string) => values.filter((other) => other !== value)
  return [
    ...query.categories.map((category) => ({
      label: `Category: ${categoryLabel(category)}`,
      without: { ...query, categories: drop(query.categories, category) },
    })),
    ...(query.tvl
      ? [{ label: `TVL ${TVL_MIN[query.tvl]?.label ?? ''}`, without: { ...query, tvl: '' } }]
      : []),
    ...(query.feedsMin
      ? [{ label: `Feeds with data ≥ ${query.feedsMin}`, without: { ...query, feedsMin: 0 } }]
      : []),
    ...query.has.map((id) => ({
      label: `Has data from ${name(id)}`,
      without: { ...query, has: drop(query.has, id) },
    })),
    ...query.missing.map((id) => ({
      label: `No data from ${name(id)}`,
      without: { ...query, missing: drop(query.missing, id) },
    })),
    ...(query.incidents
      ? [{ label: 'Has reported incidents', without: { ...query, incidents: false } }]
      : []),
    ...query.signals.map((signal) => ({
      label: `Has ${SIGNAL_LABELS[signal].toLowerCase()} signals`,
      without: { ...query, signals: query.signals.filter((other) => other !== signal) },
    })),
    ...(query.updated
      ? [{ label: UPDATED[query.updated]?.chip ?? '', without: { ...query, updated: '' } }]
      : []),
  ]
}

/** One version against the filters. Coverage filters look at whether data exists, never at a value. */
export function rowMatches(row: Row, query: MatrixQuery, now: number): boolean {
  const { protocol } = row
  const needle = query.q.trim().toLowerCase()
  const text = `${protocol.group ?? ''} ${protocol.name} ${protocol.id} ${categoryLabel(
    protocol.category,
  )}`.toLowerCase()
  if (needle && !text.includes(needle)) return false
  if (query.categories.length && !query.categories.includes(protocol.category)) return false
  const min = TVL_MIN[query.tvl]?.min
  if (min != null && (row.tvl == null || row.tvl <= min)) return false
  if (
    query.feedsMin &&
    dataCount(
      row.feeds,
      feeds.map((feed) => feed.id),
    ) < query.feedsMin
  ) {
    return false
  }
  if (query.has.some((id) => !row.feeds[id])) return false
  if (query.missing.some((id) => row.feeds[id])) return false
  if (query.incidents && !row.incidents?.count) return false
  if (query.signals.length) {
    const counts = signalCounts(Object.values(row.tones))
    if (query.signals.some((signal) => counts[signal] === 0)) return false
  }
  const window = UPDATED[query.updated]
  if (window) {
    const changed = changedAt(row)
    const recent = changed != null && now - Date.parse(changed) <= window.days * DAY
    if (query.updated === 'old' ? recent : !recent) return false
  }
  return true
}

/** Biggest first (or smallest, for `asc`); a missing figure goes last either way. */
const byNumber = (a: number | null, b: number | null, dir: 'asc' | 'desc' = 'desc'): number =>
  a == null || b == null
    ? (a == null ? 1 : 0) - (b == null ? 1 : 0)
    : dir === 'desc'
      ? b - a
      : a - b

const time = (value: string | null): number | null => (value ? Date.parse(value) : null)

/** The most negative readings any one version of the group has; versions are never added up. */
const negatives = (group: Group): number =>
  Math.max(...group.rows.map((row) => signalCounts(Object.values(row.tones)).neg))

/**
 * Filter the versions, nest them by protocol and order the groups. Pure: the
 * same rows, query and clock always give the same table.
 */
export function matrixGroups(rows: Row[], query: MatrixQuery, now: number): Group[] {
  const feedIds = feeds.map((feed) => feed.id)
  const order: Record<SortKey, (a: Group, b: Group) => number> = {
    'tvl-desc': (a, b) => byNumber(a.tvl, b.tvl),
    'tvl-asc': (a, b) => byNumber(a.tvl, b.tvl, 'asc'),
    'name-asc': () => 0,
    'coverage-desc': (a, b) =>
      byNumber(dataCount(a.feeds, feedIds), dataCount(b.feeds, feedIds)) || byNumber(a.tvl, b.tvl),
    'updated-desc': (a, b) =>
      byNumber(time(a.changedAt), time(b.changedAt)) || byNumber(a.tvl, b.tvl),
    'incidents-desc': (a, b) => byNumber(a.incidents, b.incidents) || byNumber(a.tvl, b.tvl),
    'signals-desc': (a, b) => byNumber(negatives(a), negatives(b)) || byNumber(a.tvl, b.tvl),
  }
  return groupRows(rows.filter((row) => rowMatches(row, query, now))).sort(
    (a, b) => order[query.sort](a, b) || a.name.localeCompare(b.name),
  )
}
