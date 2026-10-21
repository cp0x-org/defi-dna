import type { MatrixQuery, SortKey } from './matrix.ts'
import type { ColumnKey } from '../../shared/lib/prefs.ts'
import { Prov } from '../../shared/ui/Coverage.tsx'
import { Info } from '../../shared/ui/UI.tsx'

/**
 * Which columns sit under which provenance header; the protocol column always
 * leads the first. "Updated" is coverage too, but closes the table on its own.
 */
const COLUMN_GROUPS: Record<'meta' | 'cov' | 'src', ColumnKey[]> = {
  meta: ['category', 'tvl', 'timelock', 'governance'],
  cov: ['coverage'],
  src: ['signals', 'incidents'],
}

/** The two header rows: where each group of columns comes from, then the sortable columns. */
export const MatrixHead = ({
  query,
  onSort,
  show,
}: {
  query: MatrixQuery
  onSort: (sort: SortKey) => void
  /** Whether the visitor keeps a column in the table; the protocol column always stays. */
  show: (key: ColumnKey) => boolean
}) => {
  const shownIn = (group: keyof typeof COLUMN_GROUPS) => COLUMN_GROUPS[group].filter(show).length
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
        <th colSpan={1 + shownIn('meta')} className="g-meta">
          <Prov kind="meta">Protocol metadata</Prov>
          <span className="grp-note">registry · TVL via DefiLlama · governance read on-chain</span>
        </th>
        {shownIn('cov') > 0 ? (
          <th colSpan={shownIn('cov')} className="g-cov">
            <Prov kind="cov">Data coverage</Prov>
            <span className="grp-note">facts about our collection, not the protocol</span>
          </th>
        ) : null}
        {shownIn('src') > 0 ? (
          <th colSpan={shownIn('src')} className="g-src">
            <Prov kind="src">Source-reported</Prov>
            <span className="grp-note">what sources published — not verified or scored by us</span>
          </th>
        ) : null}
        {show('updated') ? (
          <th className="g-cov">
            <Prov kind="cov">Data coverage</Prov>
            <span className="grp-note">when a feed’s value last moved</span>
          </th>
        ) : null}
        <th />
      </tr>
      <tr className="cols">
        <th aria-sort={ariaSort('name-asc')}>{sortButton('name-asc', 'Protocol')}</th>
        {show('category') ? <th>Category</th> : null}
        {show('tvl') ? (
          <th className="num" aria-sort={ariaSort('tvl-desc', 'tvl-asc')}>
            {sortButton('tvl-desc', 'TVL', 'tvl-asc')}
          </th>
        ) : null}
        {show('timelock') ? (
          <th className="num">
            Timelock
            <Info label="Timelock">
              The delay the protocol’s governance executor — its timelock contract — enforces
              between scheduling a decision and executing it, read from that contract on Ethereum
              mainnet. The contract and the view it was read with are named on the protocol page. A
              dash means no timelock is among the contracts read, or nothing was read for this
              version.
            </Info>
          </th>
        ) : null}
        {show('governance') ? (
          <th>
            Governance
            <Info label="Governance">
              Who decides, as the governance contracts read on-chain report it, one line per body: a
              token vote (a governor or an Aragon voting app, named by its token), a multisig as
              “signatures required of signers” (the threshold the Safe reports and the size of its
              owner list), a single key as EOA, or a holder veto. Only contracts we read are listed;
              a protocol may have more. Each is linked to Etherscan on the protocol page.
            </Info>
          </th>
        ) : null}
        {show('coverage') ? (
          <th aria-sort={ariaSort('coverage-desc')}>
            {sortButton('coverage-desc', 'Coverage')}
            <span className="th-sub">feeds with data · hover for the list</span>
          </th>
        ) : null}
        {show('signals') ? (
          <th aria-sort={ariaSort('signals-desc')}>
            {sortButton('signals-desc', 'Signals')}
            <span className="th-sub">negative · neutral/info · positive</span>
          </th>
        ) : null}
        {show('incidents') ? (
          <th aria-sort={ariaSort('incidents-desc')}>
            {sortButton('incidents-desc', 'Incidents')}
            <span className="th-sub">recorded by DefiLlama</span>
          </th>
        ) : null}
        {show('updated') ? (
          <th aria-sort={ariaSort('updated-desc')}>
            {sortButton('updated-desc', 'Updated')}
            <span className="th-sub">latest move in a feed’s value</span>
          </th>
        ) : null}
        <th>
          <span className="sr-only">Open</span>
        </th>
      </tr>
    </thead>
  )
}
