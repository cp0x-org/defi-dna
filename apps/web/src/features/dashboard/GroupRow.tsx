import type { ColumnKey } from '../../shared/lib/prefs.ts'
import { feeds } from '../../shared/lib/registry.ts'
import { dataCount, type Group } from './rows.ts'
import { categoryLabel, formatUsd } from '../../shared/lib/view.ts'
import { ProtocolAvatar } from '../../shared/ui/UI.tsx'
import { Fresh } from './Fresh.tsx'
import { MultisigCell, TimelockCell } from './GovernanceCells.tsx'

const feedIds = feeds.map((feed) => feed.id)
/** The group row repeats a governance reading only when every version shares it. */
const NO_GOVERNANCE = 'Differs by version, or not read'

/** A protocol with more than one tracked version. Its figures add those versions up. */
export const GroupRow = ({
  group,
  now,
  noChangeTitle,
  noIncidentsTitle,
  show,
}: {
  group: Group
  now: number
  noChangeTitle: string
  noIncidentsTitle: string
  /** Whether the visitor keeps a column in the table; the protocol column always stays. */
  show: (key: ColumnKey) => boolean
}) => {
  const categories = [...new Set(group.rows.map((row) => row.protocol.category))]
  return (
    <tr className="group-row">
      <td>
        <div className="pcell">
          <ProtocolAvatar id={group.key} name={group.name} />
          <span>
            <strong>{group.name}</strong>
            <small>{group.rows.length} versions tracked</small>
          </span>
        </div>
      </td>
      {show('category') ? (
        <td>{categories.length === 1 ? categoryLabel(categories[0] ?? '') : 'Mixed'}</td>
      ) : null}
      {show('tvl') ? (
        <td className="num">
          <span className="mono">{formatUsd(group.tvl) ?? '—'}</span>
          <small>sum of versions</small>
        </td>
      ) : null}
      {show('timelock') ? (
        <td className="num">
          <TimelockCell governance={group.governance} absent={NO_GOVERNANCE} />
        </td>
      ) : null}
      {show('multisigs') ? (
        <td>
          <MultisigCell governance={group.governance} absent={NO_GOVERNANCE} />
        </td>
      ) : null}
      {show('coverage') ? (
        <td>
          {/* Versions can read differently in one feed; the group row shows only how many have data. */}
          <span className="cov-count" title="Feeds with data for at least one version">
            {dataCount(group.feeds, feedIds)}
            <span>/{feeds.length}</span>
            <small>any version</small>
          </span>
        </td>
      ) : null}
      {show('signals') ? <td /> : null}
      {show('incidents') ? (
        <td>
          {group.incidents == null ? (
            <span className="muted" title={noIncidentsTitle}>
              —
            </span>
          ) : (
            <span className={`evt${group.incidents ? '' : ' zero'}`}>
              {group.incidents} recorded
              <small>across versions</small>
            </span>
          )}
        </td>
      ) : null}
      {show('updated') ? (
        <td>
          <Fresh changed={group.changedAt} now={now} emptyTitle={noChangeTitle} />
        </td>
      ) : null}
      <td />
    </tr>
  )
}
