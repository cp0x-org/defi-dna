import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Feed, FeedData, IndexBundle, Protocol, ProtocolDetail } from '@defi-dna/data'
import { feeds } from '../lib/registry.ts'
import { TONE_LABELS, statusWord, toneOf, type Tone } from '../lib/status.ts'
import { ageLabel, assessesLabel, dateInfo, timeLabel } from '../lib/view.ts'
import { CoverageBar, CoverageRing, Prov, StatusPill } from './Coverage.tsx'
import { FeedExtras } from './extra/FeedExtras.tsx'
import { Block, DataAgeHelp, ExternalLink, SourceMark } from './UI.tsx'

/** Sidebar groups: feeds with a reading of their own first, then data without one, then gaps. */
const GROUPS: [Tone[], string][] = [
  [['neg', 'neu', 'pos'], 'Reporting · own reading'],
  [['inf'], 'Reporting · no reading on its scale'],
  [['none'], 'No data'],
  [['error'], 'Collection error'],
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
  const status = data?.status ?? 'none'
  const tone = toneOf(feed, data)
  const word = statusWord(feed, data?.value)
  const details = data?.details ?? []
  const assessed = dateInfo(data?.updatedAt)
  const source = data?.url ?? feed.homepage

  const head = (
    <div className="src-h">
      <SourceMark id={feed.id} large />
      <div>
        <div className="src-title">
          <h2>{feed.name}</h2>
          <StatusPill tone={tone} dot />
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
        {feed.status && tone !== 'inf' ? (
          <span>
            Status colour: {feed.status.rule} “{data.value}” reads as <b>{TONE_LABELS[tone]}</b>
            {word ? ` (“${word}”)` : ''}.
          </span>
        ) : (
          <span>
            No status colour: {feed.name}’s own scale gives no reading of this value, so it is shown
            as neutral data. We set no threshold of our own.
          </span>
        )}
        <Link className="text-link" to="/methodology">
          How to read
        </Link>
      </div>
      <div className="mapping">
        <Prov kind="cp" />
        <span>
          {feed.name} assesses {assessesLabel(feed.assesses)}. Its values appear exactly as
          published and are not converted into any other feed’s scale.
        </span>
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
  const toneFor = (feed: Feed): Tone => toneOf(feed, record.feeds[feed.id])
  const states = feeds.map(toneFor)
  const withData = feeds.filter((feed) => record.feeds[feed.id]?.status === 'ok').length
  const selected = feeds.find((feed) => feed.id === feedId)

  const item = (feed: Feed) => {
    const tone = toneFor(feed)
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
        <span className={`rs-st st-${tone}`}>
          {TONE_LABELS[tone]}
          <small>
            {record.feeds[feed.id]?.status === 'ok'
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
        {GROUPS.map(([tones, label]) => {
          const members = feeds.filter((feed) => tones.includes(toneFor(feed)))
          return members.length > 0 ? (
            <div key={label}>
              <div className="rs-group">
                <span>{label}</span>
                <span className="mono">{members.length}</span>
              </div>
              {members.map(item)}
            </div>
          ) : null
        })}
        <div className="rs-foot">
          A colour is the feed’s own characterization, read from its own published scale. Data whose
          scale gives no reading is neutral; no data is grey. Dates are each feed’s own.
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
                Status colours place each headline on the publishing feed’s own scale. They are not
                added up — there is no overall score — and each feed may cover a different slice of{' '}
                {protocol.name}.
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
                      const status = data?.status ?? 'none'
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
                            <StatusPill tone={toneFor(feed)} />
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
