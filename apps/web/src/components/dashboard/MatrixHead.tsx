import type { MatrixQuery, SortKey } from '../../lib/matrix.ts'
import { Prov } from '../Coverage.tsx'

/** The two header rows: where each group of columns comes from, then the sortable columns. */
export const MatrixHead = ({
  query,
  onSort,
}: {
  query: MatrixQuery
  onSort: (sort: SortKey) => void
}) => {
  const sortButton = (key: SortKey, label: string, alternate?: SortKey) => {
    const active = query.sort === key || query.sort === alternate
    return (
      <button
        type="button"
        className={`th-sort${active ? ' sorted' : ''}`}
        onClick={() => onSort(query.sort === key && alternate ? alternate : key)}
      >
        {label}{' '}
        <span className="arr" aria-hidden="true">
          {query.sort === alternate ? '↑' : active ? '↓' : '↕'}
        </span>
      </button>
    )
  }
  const ariaSort = (...keys: SortKey[]) =>
    keys.includes(query.sort)
      ? query.sort.endsWith('asc')
        ? ('ascending' as const)
        : ('descending' as const)
      : undefined

  return (
    <thead>
      <tr className="grp">
        <th colSpan={3} className="g-meta">
          <Prov kind="meta">Protocol metadata</Prov>
          <span className="grp-note">registry · TVL via DefiLlama</span>
        </th>
        <th colSpan={2} className="g-cov">
          <Prov kind="cov">Data coverage</Prov>
          <span className="grp-note">facts about our collection, not the protocol</span>
        </th>
        <th colSpan={2} className="g-src">
          <Prov kind="src">Source-reported</Prov>
          <span className="grp-note">what sources published — not verified or scored by us</span>
        </th>
        <th />
      </tr>
      <tr className="cols">
        <th aria-sort={ariaSort('name-asc')}>{sortButton('name-asc', 'Protocol')}</th>
        <th>Category</th>
        <th className="num" aria-sort={ariaSort('tvl-desc', 'tvl-asc')}>
          {sortButton('tvl-desc', 'TVL', 'tvl-asc')}
        </th>
        <th aria-sort={ariaSort('coverage-desc')}>
          {sortButton('coverage-desc', 'Coverage')}
          <span className="th-sub">feeds with data · hover for the list</span>
        </th>
        <th aria-sort={ariaSort('updated-desc')}>
          {sortButton('updated-desc', 'Changed')}
          <span className="th-sub">latest move in a feed’s value</span>
        </th>
        <th aria-sort={ariaSort('signals-desc')}>
          {sortButton('signals-desc', 'Signals')}
          <span className="th-sub">negative · neutral/info · positive</span>
        </th>
        <th aria-sort={ariaSort('incidents-desc')}>
          {sortButton('incidents-desc', 'Incidents')}
          <span className="th-sub">recorded by DefiLlama</span>
        </th>
        <th>
          <span className="sr-only">Open</span>
        </th>
      </tr>
    </thead>
  )
}
