import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Feed, FeedData, IndexBundle, Protocol, ProtocolDetail } from '@defi-dna/data'
import { feeds } from '../lib/registry.ts'
import { ageLabel, assessesLabel, coverageLabel, dateInfo, timeLabel } from '../lib/view.ts'
import { CoverageBar, CoverageRing, Prov, StatusPill, type Status } from './Coverage.tsx'
import { FeedExtras } from './extra/FeedExtras.tsx'
import { Block, DataAgeHelp, ExternalLink, SourceMark } from './UI.tsx'

const GROUPS: [Status, string][] = [
  ['ok', 'With data'],
  ['none', 'No data'],
  ['error', 'Collection error'],
]

const hostOf = (url?: string): string | null => {
  try {
    return url ? new URL(url).host.replace(/^www\./, '') : null
  } catch {
    return null
  }
}

/**
 * Everything one feed published about one protocol, as blocks in the order of
 * the stored record. The shell — header, scope line, attribution — is ours; the
 * blocks are the feed's, and nothing in them is reworded, summarised or scored.
 */
export const FeedSource = ({
  feed,
  data,
  protocol,
  lastRead,
  covered,
}: {
  feed: Feed
  data?: FeedData
  protocol: Protocol
  /** When our pipeline last read this feed without a failure. */
  lastRead?: string
  /** How many protocol versions this feed has data for, when the index is loaded. */
  covered?: string
}) => {
  const [showTypes, setShowTypes] = useState(true)
  const status: Status = data?.status ?? 'none'
  const details = data?.details ?? []
  const assessed = dateInfo(data?.updatedAt)
  const source = data?.url ?? feed.homepage

  const head = (
    <div className="src-h">
      <SourceMark id={feed.id} large />
      <div>
        <div className="src-title">
          <h2>{feed.name}</h2>
          <StatusPill status={status} dot />
        </div>
        <div className="src-meta">
          <span>{feed.topic}</span>
          {status === 'ok' ? (
            <span className="src-date">
              Assessed <b className={assessed.older ? 'older' : undefined}>{assessed.label}</b>
              <DataAgeHelp />
            </span>
          ) : null}
          {lastRead ? <span>Last read {ageLabel(lastRead)} ago</span> : null}
          <span>
            Scope: <b>{assessesLabel(feed.assesses)}</b>
          </span>
        </div>
      </div>
      <div className="src-actions">
        {feed.methodologyUrl ? (
          <ExternalLink className="linkbtn" href={feed.methodologyUrl}>
            Methodology
          </ExternalLink>
        ) : null}
        <ExternalLink className="linkbtn primary" href={source}>
          {data?.url ? 'Open original source' : 'Feed website'}
        </ExternalLink>
      </div>
    </div>
  )

  if (status !== 'ok' || !data) {
    const failed = status === 'error'
    return (
      <>
        {head}
        <div className="empty-src">
          <h3>
            {failed
              ? `We could not read ${feed.name} for ${protocol.name}.`
              : `${feed.name} has not published anything we could map to ${protocol.name}.`}
          </h3>
          <div className="es-note">
            <Prov kind="cp" />
            {failed ? (
              <span>
                <b>This is our failure.</b> It says nothing about coverage, and nothing about the
                protocol. The previous value, if any, is kept until a read succeeds.
              </span>
            ) : (
              <span>
                <b>No data is not a signal.</b> It means this feed has not covered {protocol.name}{' '}
                under anything we map — not that it looked and found nothing.
              </span>
            )}
          </div>
          <dl className="facts one">
            <div>
              <dt>Last read by defi-dna</dt>
              <dd>{timeLabel(lastRead) ?? 'Not known'}</dd>
            </div>
            <div>
              <dt>Versions this feed covers</dt>
              <dd>{covered ?? '—'}</dd>
            </div>
            {data?.note ? (
              <div>
                <dt>{failed ? 'What went wrong' : 'Why this is empty'}</dt>
                <dd>{data.note}</dd>
              </div>
            ) : null}
          </dl>
          <div className="actions">
            <ExternalLink className="linkbtn" href={feed.homepage}>
              Open {feed.name}
            </ExternalLink>
            <Link className="linkbtn" to="/methodology#contribute">
              Suggest a mapping
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {head}
      <div className="mapping">
        <Prov kind="cp" />
        <span>
          {feed.name} assesses {assessesLabel(feed.assesses)}. Its values appear exactly as
          published and are not converted into any other feed’s scale.
        </span>
        <Link className="text-link" to="/methodology">
          How to read
        </Link>
      </div>
      <div className="attrib">
        <Prov kind="src">Source content</Prov>
        <span>
          Everything below is published by <b>{feed.name}</b> and shown as collected. defi-dna does
          not edit, summarise or score it.
        </span>
        <label className="cb">
          <input
            type="checkbox"
            checked={showTypes}
            onChange={(event) => setShowTypes(event.target.checked)}
          />
          Show field names
        </label>
      </div>
      <div className={`blocks${showTypes ? '' : ' hide-types'}`}>
        {data.value ? (
          <Block type="value">
            <div className="b-score">
              <div className="b-title">Headline value</div>
              <div className="b-score-row">
                <span className="v">{data.value}</span>
                <span className="scale">as {feed.name} publishes it</span>
              </div>
            </div>
          </Block>
        ) : null}
        {data.note ? (
          <Block type="note">
            <div className="b-warn">
              <b>Note:</b> {data.note}
            </div>
          </Block>
        ) : null}
        {data.summary ? (
          <Block type="summary">
            <h4 className="b-title">In {feed.name}’s words</h4>
            <p className="b-text quote">{data.summary}</p>
          </Block>
        ) : null}
        {details.length > 0 ? (
          <Block type="details" count={details.length}>
            <h4 className="b-title">{feed.name}’s breakdown</h4>
            <dl className="b-dims">
              {details.map((detail) => (
                <div key={detail.name}>
                  <dt>{detail.name}</dt>
                  <dd>
                    <span className="pill plain">{detail.value}</span>
                    {detail.description ? <p>{detail.description}</p> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </Block>
        ) : null}
        <FeedExtras extra={data.extra} feedName={feed.name} />
        <Block type="url">
          <ExternalLink className="b-link" href={source}>
            <b>{data.url ? 'Open the original assessment' : `${feed.name} website`}</b>
            <span>{hostOf(source)}</span>
          </ExternalLink>
        </Block>
      </div>
    </>
  )
}

/** The sidebar and the reading panel: every feed, or one feed in full. */
export const RiskIntelligence = ({
  protocol,
  record,
  index,
  feedId,
}: {
  protocol: Protocol
  record: ProtocolDetail
  index: IndexBundle | null
  feedId: string
}) => {
  const navigate = useNavigate()
  const base = `/protocol/${protocol.id}/risk`
  const statusOf = (id: string): Status => record.feeds[id]?.status ?? 'none'
  const states = feeds.map((feed) => statusOf(feed.id))
  const withData = states.filter((status) => status === 'ok').length
  const selected = feeds.find((feed) => feed.id === feedId)

  const item = (feed: Feed) => {
    const status = statusOf(feed.id)
    const lastRead = index?.sources?.[feed.id]?.lastOkAt
    return (
      <Link
        key={feed.id}
        className={`rs-item${selected?.id === feed.id ? ' on' : ''}`}
        to={`${base}/${feed.id}`}
        aria-current={selected?.id === feed.id ? 'page' : undefined}
      >
        <SourceMark id={feed.id} />
        <span>
          <b>{feed.name}</b>
          <small>{feed.topic}</small>
        </span>
        <span className={`rs-st st-${status}`}>
          {coverageLabel(status)}
          <small>
            {status === 'ok'
              ? dateInfo(record.feeds[feed.id]?.updatedAt).label
              : lastRead
                ? `read ${ageLabel(lastRead)} ago`
                : ''}
          </small>
        </span>
      </Link>
    )
  }

  return (
    <div className="risk">
      <aside className="card rside" aria-label="Feeds">
        <Link
          className={`rs-item${selected ? '' : ' on'}`}
          to={base}
          aria-current={selected ? undefined : 'page'}
        >
          <CoverageRing states={states} size={22} />
          <span>
            <b>All feeds</b>
            <small>every feed’s headline</small>
          </span>
          <span className="rs-st">
            <span className="mono">
              {withData}/{feeds.length}
            </span>
          </span>
        </Link>
        {GROUPS.map(([status, label]) => {
          const members = feeds.filter((feed) => statusOf(feed.id) === status)
          return members.length > 0 ? (
            <div key={status}>
              <div className="rs-group">
                <span>{label}</span>
                <span className="mono">{members.length}</span>
              </div>
              {members.map(item)}
            </div>
          ) : null
        })}
        <div className="rs-foot">
          The status says whether a feed publishes data we could collect — never what it concluded.
          Dates are each feed’s own.
        </div>
      </aside>

      <section className="card" aria-live="polite">
        {selected ? (
          <FeedSource
            feed={selected}
            data={record.feeds[selected.id]}
            protocol={protocol}
            lastRead={index?.sources?.[selected.id]?.lastOkAt}
            covered={
              index
                ? `${index.rows.filter((row) => row.feeds[selected.id]).length} of ${index.rows.length}`
                : undefined
            }
          />
        ) : (
          <>
            <div className="src-h">
              <CoverageRing states={states} size={40} label={String(withData)} />
              <div>
                <div className="src-title">
                  <h2>All feeds</h2>
                  <span className="pill plain">
                    {withData} / {feeds.length} with data
                  </span>
                </div>
                <div className="src-meta">
                  <span>
                    Each row quotes that feed’s own headline. Pick a feed to read everything it
                    publishes.
                  </span>
                </div>
              </div>
              <div className="src-actions">
                <CoverageBar states={states} />
              </div>
            </div>
            <div className="mapping">
              <Prov kind="cp" />
              <span>
                Headlines are not added up and there is no overall score — each sits on its own
                feed’s scale and may cover a different slice of {protocol.name}.
              </span>
            </div>
            <div className="card-b">
              <div className="tscroll">
                <table className="tbl clickable">
                  <thead>
                    <tr>
                      <th>Feed</th>
                      <th>Topic</th>
                      <th>Status</th>
                      <th>Headline (as published)</th>
                      <th>Assesses</th>
                      <th>Assessed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeds.map((feed) => {
                      const data = record.feeds[feed.id]
                      const status = statusOf(feed.id)
                      return (
                        <tr key={feed.id} onClick={() => navigate(`${base}/${feed.id}`)}>
                          <td>
                            <Link className="feed-cell" to={`${base}/${feed.id}`}>
                              <SourceMark id={feed.id} />
                              {feed.name}
                            </Link>
                          </td>
                          <td>{feed.topic}</td>
                          <td>
                            <StatusPill status={status} />
                          </td>
                          <td className="wrap">
                            {status === 'ok' && data?.value ? (
                              <q>{data.value}</q>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="wrap muted">{assessesLabel(feed.assesses)}</td>
                          <td className="mono">
                            {status === 'ok' ? dateInfo(data?.updatedAt).label : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
