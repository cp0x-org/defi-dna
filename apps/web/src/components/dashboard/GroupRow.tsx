import { feeds } from '../../lib/registry.ts'
import { dataCount, type Group } from '../../lib/rows.ts'
import { categoryLabel, formatUsd } from '../../lib/view.ts'
import { ProtocolAvatar } from '../UI.tsx'
import { Fresh } from './Fresh.tsx'

const feedIds = feeds.map((feed) => feed.id)

/** A protocol with more than one tracked version. Its figures add those versions up. */
export const GroupRow = ({
  group,
  now,
  noChangeTitle,
  noIncidentsTitle,
}: {
  group: Group
  now: number
  noChangeTitle: string
  noIncidentsTitle: string
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
      <td>{categories.length === 1 ? categoryLabel(categories[0] ?? '') : 'Mixed'}</td>
      <td className="num">
        <span className="mono">{formatUsd(group.tvl) ?? '—'}</span>
        <small>sum of versions</small>
      </td>
      <td>
        {/* Versions can read differently in one feed; the group row shows only how many have data. */}
        <span className="cov-count" title="Feeds with data for at least one version">
          {dataCount(group.feeds, feedIds)}
          <span>/{feeds.length}</span>
          <small>any version</small>
        </span>
      </td>
      <td>
        <Fresh changed={group.changedAt} now={now} emptyTitle={noChangeTitle} />
      </td>
      <td />
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
      <td />
    </tr>
  )
}
