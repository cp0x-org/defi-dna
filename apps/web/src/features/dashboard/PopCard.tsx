import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { feedName, feeds } from '../../shared/lib/registry.ts'
import { changedWithinDay, dataCount, type Row } from './rows.ts'
import { ageLabel, dateInfo, formatDuration } from '../../shared/lib/view.ts'
import { FeedStatusList } from './FeedStatusList.tsx'
import type { PopKind } from './usePopover.ts'

const feedIds = feeds.map((feed) => feed.id)
/** Facts shown on the card before the rest is left to the Governance tab. */
const FACTS_SHOWN = 6
/** A contract address read as a fact: on the card it is noise, on the tab a link. */
const ADDRESS = /^0x[0-9a-fA-F]{40}$/

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

/**
 * The timelock figure with the readings behind it: each delay the contracts
 * enforce (a protocol with a faster emergency path shows both), then the
 * modes and committees, in the order the metric read them.
 */
const TimelockCard = ({ row, pinned, onClose }: CardProps) => {
  const governance = row.governance
  const facts = (governance?.facts ?? []).filter((fact) => !ADDRESS.test(fact.value))
  const shown = facts.slice(0, FACTS_SHOWN)
  const more = facts.length - shown.length
  return (
    <>
      <div className="pop-h">
        <strong>Governance timelock · {row.protocol.name}</strong>
        <span className="mono">{formatDuration(governance?.delay) ?? '—'}</span>
      </div>
      <div className="pop-sub">
        {governance?.delay == null
          ? 'None of the contracts read for this version is a timelock.'
          : `${governance.delay.toLocaleString('en-US')} seconds between scheduling and execution, as the timelock contract reports it.`}
      </div>
      {shown.length > 0 ? (
        <dl className="facts one pop-facts">
          {shown.map((fact) => (
            <div key={fact.name}>
              <dt>{fact.name}</dt>
              <dd className="mono">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {more > 0 ? (
        <div className="pop-body">
          +{more} more reading{more === 1 ? '' : 's'} on the Governance tab.
        </div>
      ) : null}
      <Foot
        pinned={pinned}
        text="Read on-chain"
        to={`/protocol/${row.protocol.id}/governance`}
        link="Governance →"
        onClose={onClose}
      />
    </>
  )
}

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
        Listed as DefiLlama published them. defidna does not verify, classify or score incidents.
      </div>
      <Foot
        pinned={pinned}
        text="Source: DefiLlama"
        to={`/protocol/${row.protocol.id}/governance#incidents`}
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
  timelock: TimelockCard,
  incidents: IncidentsCard,
  changes: ChangesCard,
}

/** The open card. One component per kind, chosen here. */
export const PopCard = ({ kind, ...props }: CardProps & { kind: PopKind }) => {
  const Card = CARDS[kind]
  return <Card {...props} />
}
