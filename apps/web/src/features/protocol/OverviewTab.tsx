import { Link } from 'react-router-dom'
import type { Change, Protocol, ProtocolDetail } from '@defi-dna/data'
import {
  GOVERNANCE_METRIC,
  INCIDENTS_METRIC,
  TVL_METRIC,
  feedName,
  feeds,
} from '../../shared/lib/registry.ts'
import type { RecordSummary } from './record.ts'
import { dateInfo, dayAndTime, formatDuration } from '../../shared/lib/view.ts'
import { CoverageRing, StatusPill } from '../../shared/ui/Coverage.tsx'
import { Info, SourceMark } from '../../shared/ui/UI.tsx'

const TIMELINE_SHOWN = 8

/**
 * The summary, in the order a reader needs it: what each risk feed publishes
 * first, then the run log and the protocol's own figures, each stated once.
 */
export const OverviewTab = ({
  protocol,
  record,
  versions,
  summary,
  changes,
  changelogError,
  changelogLoading,
}: {
  protocol: Protocol
  record: ProtocolDetail
  versions: Protocol[]
  summary: RecordSummary
  changes: Change[]
  changelogError: string | null
  changelogLoading: boolean
}) => {
  const base = `/protocol/${protocol.id}`
  const tvl = record.metrics?.[TVL_METRIC]
  const incidents = record.metrics?.[INCIDENTS_METRIC]
  const governance = record.metrics?.[GOVERNANCE_METRIC]

  return (
    <div className="stack overview">
      <section className="card">
        <div className="card-h">
          <h2>What the risk feeds publish</h2>
          <span className="aside">
            <CoverageRing states={summary.tones} size={26} />
            <span>
              {summary.withData.length} of {feeds.length} risk feeds publish data about{' '}
              {protocol.name}
            </span>
            <Link className="text-link" to={`${base}/risk`}>
              Read each feed in full →
            </Link>
          </span>
        </div>
        <div className="card-b">
          <div className="ftiles">
            {feeds.map((feed, k) => {
              const data = record.feeds[feed.id]
              const status = data?.status ?? 'none'
              const tone = summary.tones[k] ?? 'none'
              return (
                <Link key={feed.id} className={`ftile st-${tone}`} to={`${base}/risk/${feed.id}`}>
                  <span className="ft-top">
                    <SourceMark id={feed.id} />
                    <b>{feed.name}</b>
                    <StatusPill tone={tone} />
                  </span>
                  <span className="ft-head">
                    {status === 'ok' && data?.value ? (
                      <q>{data.value}</q>
                    ) : status === 'error' ? (
                      'We could not read this feed'
                    ) : (
                      `No data published about ${protocol.name}`
                    )}
                  </span>
                  <span className="ft-meta">
                    {feed.topic}
                    {status === 'ok' ? ` · assessed ${dateInfo(data?.updatedAt).label}` : ''}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
        <div className="card-f">
          <span>
            Quoted text is each feed’s own headline. Status colour is positioned on that feed’s own
            scale; neutral where the scale gives no reading.
          </span>
          <span>No data ≠ no risk</span>
        </div>
      </section>

      <div className="two">
        <section className="card">
          <div className="card-h">
            <h2>Latest changes</h2>
            <span className="aside">from our run log</span>
          </div>
          <div className="card-b tl-body">
            {changelogError ? (
              <p className="muted">The run log could not be loaded.</p>
            ) : changelogLoading ? (
              <div className="loading-track" />
            ) : changes.length === 0 ? (
              <p className="muted">No change recorded for {protocol.name} since the log began.</p>
            ) : (
              <ul className="tl">
                {changes.slice(0, TIMELINE_SHOWN).map((change, k) => {
                  const [day, time] = dayAndTime(change.ts)
                  return (
                    <li key={`${change.ts}-${change.feedId}-${k}`}>
                      <span className="d">
                        {day}
                        <small>{time}</small>
                      </span>
                      <span className="who">
                        <SourceMark id={change.feedId} />
                      </span>
                      <div>
                        <div className="what">
                          <b>{feedName(change.feedId)}</b>{' '}
                          {change.from === null ? 'published a first value' : 'changed its value'}
                        </div>
                        <div className="det">
                          {change.from === null ? null : (
                            <>
                              <q>{change.from}</q> →{' '}
                            </>
                          )}
                          {change.to === null ? 'no value' : <q>{change.to}</q>}, as published.
                        </div>
                      </div>
                      <Link className="go" to={`${base}/risk/${change.feedId}`}>
                        View feed →
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="card-f">
            <span>
              A change is logged when a feed’s published value moves between two runs. Values are
              quoted from the feed.
            </span>
            <Link className="text-link" to="/changelog">
              Full log →
            </Link>
          </div>
        </section>

        <aside className="stack">
          <section className="card">
            <div className="card-h">
              <h2>Key figures</h2>
              <span className="aside">registry · DefiLlama · on-chain</span>
            </div>
            <div className="card-b kv-body">
              <dl className="kv">
                <div>
                  <dt>
                    Governance timelock
                    <Info label="What this figure is">
                      The delay the protocol’s governance timelock enforces before a scheduled
                      decision executes, as the contract reports it on Ethereum mainnet. Empty when
                      none of the contracts we read is a timelock, or none is mapped.
                    </Info>
                  </dt>
                  <dd>
                    {formatDuration(governance?.value) ?? '—'}
                    <small>read on-chain</small>
                  </dd>
                </div>
                <div>
                  <dt>Incidents recorded</dt>
                  <dd>
                    {incidents?.value ?? '—'}
                    <small>by DefiLlama</small>
                  </dd>
                </div>
                <div>
                  <dt>Latest incident</dt>
                  <dd>
                    {summary.latestIncident ? dateInfo(summary.latestIncident.date).label : '—'}
                    {summary.latestIncident ? (
                      <small>{summary.latestIncident.classification}</small>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>TVL components</dt>
                  <dd>
                    {tvl?.extra?.components?.length ?? '—'}
                    <small>DefiLlama ids summed</small>
                  </dd>
                </div>
                <div>
                  <dt>Protocol versions tracked</dt>
                  <dd>{versions.length}</dd>
                </div>
                <div>
                  <dt>Registry id</dt>
                  <dd>{protocol.id}</dd>
                </div>
              </dl>
            </div>
            <div className="card-f">
              <span>
                {record.metrics
                  ? `DefiLlama · collected ${dateInfo(tvl?.fetchedAt).label}`
                  : 'DefiLlama’s figures could not be loaded'}
              </span>
              <Link className="text-link" to={`${base}/governance`}>
                All figures →
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
