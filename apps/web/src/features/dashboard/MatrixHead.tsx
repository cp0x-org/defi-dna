import type { MatrixQuery, SortKey } from './matrix.ts'
import type { ColumnKey } from '../../shared/lib/prefs.ts'
import { Info } from '../../shared/ui/UI.tsx'

/** The header row: one sortable column per fact, each with its definition behind a "?". */
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
            <Info label="Coverage">
              How many feeds have data for this version. Hover a cell for the list.
            </Info>
          </th>
        ) : null}
        {show('incidents') ? (
          <th aria-sort={ariaSort('incidents-desc')}>
            {sortButton('incidents-desc', 'Incidents')}
            <Info label="Incidents">Incidents recorded by DefiLlama for this version.</Info>
          </th>
        ) : null}
        <th>
          <span className="sr-only">Open</span>
        </th>
      </tr>
    </thead>
  )
}
