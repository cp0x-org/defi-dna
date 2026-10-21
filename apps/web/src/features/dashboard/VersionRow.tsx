import { Link, useNavigate } from 'react-router-dom'
import type { ColumnKey } from '../../shared/lib/prefs.ts'
import { feeds } from '../../shared/lib/registry.ts'
import { changedAt, changedWithinDay, dataCount, type Row } from './rows.ts'
import { SIGNALS, signalCounts, type Tone } from '../../shared/lib/status.ts'
import { categoryLabel, dateInfo, formatUsd } from '../../shared/lib/view.ts'
import { CoverageBar, CoverageRing } from '../../shared/ui/Coverage.tsx'
import { ProtocolAvatar } from '../../shared/ui/UI.tsx'
import { Fresh } from './Fresh.tsx'
import { GovernanceCell, TimelockCell } from './GovernanceCells.tsx'
import type { PopKind, PopTarget } from './usePopover.ts'

const feedIds = feeds.map((feed) => feed.id)
const tonesOf = (row: Row): Tone[] => feeds.map((feed) => row.tones[feed.id] ?? 'none')

/** One protocol version. The whole row opens the protocol page; the buttons open cards instead. */
export const VersionRow = ({
  row,
  nested,
  now,
  noChangeTitle,
  noIncidentsTitle,
  noGovernanceTitle,
  popTarget,
  show,
}: {
  row: Row
  nested: boolean
  now: number
  noChangeTitle: string
  noIncidentsTitle: string
  noGovernanceTitle: string
  popTarget: (kind: PopKind, protocolId: string) => PopTarget
  /** Whether the visitor keeps a column in the table; the protocol column always stays. */
  show: (key: ColumnKey) => boolean
}) => {
  const navigate = useNavigate()
  const { protocol, incidents } = row
  const href = `/protocol/${protocol.id}`
  const states = tonesOf(row)
  const covered = dataCount(row.feeds, feedIds)
  const counts = signalCounts(states)
  const today = changedWithinDay(row, now)
  return (
    <tr className={nested ? 'version-row' : undefined} onClick={() => navigate(href)}>
      <td>
        <div className="pcell">
          {nested ? (
            <span className="vtick" aria-hidden="true" />
          ) : (
            <ProtocolAvatar id={protocol.id} name={protocol.name} />
          )}
          <span>
            <Link className="pname" to={href} onClick={(event) => event.stopPropagation()}>
              <strong>{protocol.name}</strong>
            </Link>
            {today.length > 0 ? (
              <button
                type="button"
                className="new"
                aria-label={`${today.length} changes in the last 24 hours`}
                {...popTarget('changes', protocol.id)}
              >
                NEW · {today.length}
              </button>
            ) : null}
            <small className="mono">{protocol.id}</small>
          </span>
        </div>
      </td>
      {show('category') ? <td>{categoryLabel(protocol.category)}</td> : null}
      {show('tvl') ? (
        <td className="num">
          <span className="mono">{formatUsd(row.tvl) ?? '—'}</span>
          <small>Ethereum</small>
        </td>
      ) : null}
      {show('timelock') ? (
        <td className="num">
          <TimelockCell governance={row.governance} absent={noGovernanceTitle} />
        </td>
      ) : null}
      {show('governance') ? (
        <td>
          <GovernanceCell governance={row.governance} absent={noGovernanceTitle} />
        </td>
      ) : null}
      {show('coverage') ? (
        <td>
          <button
            type="button"
            className="hit"
            aria-label={`${covered} of ${feeds.length} feeds have data — show the list`}
            {...popTarget('coverage', protocol.id)}
          >
            <span className="v-ring">
              <CoverageRing states={states} />
            </span>
            <span className="v-bar">
              <CoverageBar states={states} />
            </span>
            <span className="cov-count">
              {covered}
              <span>/{feeds.length}</span>
            </span>
          </button>
        </td>
      ) : null}
      {show('signals') ? (
        <td>
          <button
            type="button"
            className="hit sig"
            aria-label={`Feed signals: ${counts.neg} negative, ${counts.neu} neutral or informational, ${counts.pos} positive`}
            {...popTarget('signals', protocol.id)}
          >
            {SIGNALS.map((signal) => (
              <span key={signal} className={`sc ${signal}${counts[signal] ? '' : ' zero'}`}>
                <i />
                {counts[signal]}
              </span>
            ))}
          </button>
        </td>
      ) : null}
      {show('incidents') ? (
        <td>
          {incidents == null ? (
            <span className="muted" title={noIncidentsTitle}>
              —
            </span>
          ) : incidents.count === 0 ? (
            <span className="evt zero">0 recorded</span>
          ) : (
            <button type="button" className="hit" {...popTarget('incidents', protocol.id)}>
              <span>
                <span className="evt">{incidents.count} recorded</span>
                {incidents.latest ? (
                  <small>latest {dateInfo(incidents.latest.date).label}</small>
                ) : null}
              </span>
            </button>
          )}
        </td>
      ) : null}
      {show('updated') ? (
        <td>
          <Fresh changed={changedAt(row)} now={now} emptyTitle={noChangeTitle} />
        </td>
      ) : null}
      <td className="go" aria-hidden="true">
        →
      </td>
    </tr>
  )
}
