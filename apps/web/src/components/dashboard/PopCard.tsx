import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { feedName, feeds } from '../../lib/registry.ts'
import { changedWithinDay, dataCount, type Row } from '../../lib/rows.ts'
import { SIGNALS, SIGNAL_LABELS, signalOf } from '../../lib/status.ts'
import { ageLabel, dateInfo } from '../../lib/view.ts'
import { FeedStatusList } from './FeedStatusList.tsx'
import type { PopKind } from './usePopover.ts'

const feedIds = feeds.map((feed) => feed.id)

const Foot = ({
  pinned,
  text,
  to,
  link,
  onClose,
}: {
  pinned: boolean
  text: string
  to: string
  link: string
  onClose: () => void
}) => (
  <div className="pop-f">
    <span>{pinned ? 'Esc to close' : text}</span>
    <Link to={to} onClick={onClose}>
      {link}
    </Link>
  </div>
)

const CoverageCard = ({ row, pinned, onClose }: CardProps) => (
  <>
    <div className="pop-h">
      <strong>{row.protocol.name}</strong>
      <span className="mono">
        {dataCount(row.feeds, feedIds)} / {feeds.length} feeds
      </span>
    </div>
    <div className="pop-sub">Status as each feed characterizes its own data</div>
    <FeedStatusList feeds={feeds} tones={row.tones} />
    <Foot
      pinned={pinned}
      text="Click to pin"
      to={`/protocol/${row.protocol.id}/risk`}
      link="Risk intelligence →"
      onClose={onClose}
    />
  </>
)

const SignalsCard = ({ row, pinned, onClose }: CardProps) => (
  <>
    <div className="pop-h">
      <strong>Feed signals · {row.protocol.name}</strong>
    </div>
    <div className="pop-sub">
      Feeds grouped by their own characterization. Not combined into a verdict.
    </div>
    {SIGNALS.map((signal) => {
      const members = feeds.filter((feed) => signalOf(row.tones[feed.id] ?? 'none') === signal)
      return members.length > 0 ? (
        <div key={signal}>
          <div className="pop-group">
            {SIGNAL_LABELS[signal]} · {members.length}
          </div>
          <FeedStatusList feeds={members} tones={row.tones} />
        </div>
      ) : null
    })}
    <Foot
      pinned={pinned}
      text={`${dataCount(row.feeds, feedIds)} of ${feeds.length} feeds reporting`}
      to={`/protocol/${row.protocol.id}/risk`}
      link="Read each feed →"
      onClose={onClose}
    />
  </>
)

const IncidentsCard = ({ row, pinned, onClose }: CardProps) => {
  const latest = row.incidents?.latest
  return (
    <>
      <div className="pop-h">
        <strong>Incidents · {row.protocol.name}</strong>
      </div>
      <div className="pop-body">
        <b>
          {row.incidents?.count} incident{row.incidents?.count === 1 ? '' : 's'}
        </b>{' '}
        recorded by <b>DefiLlama</b>.
        {latest ? ` Latest: ${dateInfo(latest.date).label}, “${latest.name}”.` : ''}
        <br />
        Listed as DefiLlama published them. defi-dna does not verify, classify or score incidents.
      </div>
      <Foot
        pinned={pinned}
        text="Source: DefiLlama"
        to={`/protocol/${row.protocol.id}/data`}
        link="Open incidents →"
        onClose={onClose}
      />
    </>
  )
}

const ChangesCard = ({ row, pinned, now, onClose }: CardProps) => {
  const today = changedWithinDay(row, now)
  return (
    <>
      <div className="pop-h">
        <strong>
          {today.length} change{today.length === 1 ? '' : 's'} in the last 24h
        </strong>
      </div>
      <ul className="pop-list">
        {today.map((change, k) => (
          <li key={`${change.ts}-${change.feedId}-${k}`}>
            <span className="mono muted age">{ageLabel(change.ts, now)}</span>
            <span>
              <b>{feedName(change.feedId)}</b>{' '}
              {change.from === null ? 'published a first value' : 'changed its value'}
            </span>
          </li>
        ))}
      </ul>
      <Foot
        pinned={pinned}
        text="Moves in published values"
        to={`/protocol/${row.protocol.id}`}
        link="Latest changes →"
        onClose={onClose}
      />
    </>
  )
}

interface CardProps {
  row: Row
  pinned: boolean
  now: number
  onClose: () => void
}

const CARDS: Record<PopKind, (props: CardProps) => ReactNode> = {
  coverage: CoverageCard,
  signals: SignalsCard,
  incidents: IncidentsCard,
  changes: ChangesCard,
}

/** The open card. One component per kind, chosen here. */
export const PopCard = ({ kind, ...props }: CardProps & { kind: PopKind }) => {
  const Card = CARDS[kind]
  return <Card {...props} />
}
