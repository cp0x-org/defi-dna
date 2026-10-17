import { Link } from 'react-router-dom'
import type { Change, Protocol, ProtocolDetail } from '@defi-dna/data'
import { TVL_METRIC, INCIDENTS_METRIC, feedName, feeds } from '../../lib/registry.ts'
import type { RecordSummary } from '../../lib/record.ts'
import { dateInfo, dayAndTime, formatUsd } from '../../lib/view.ts'
import { CoverageRing, Prov, StatusPill } from '../../components/Coverage.tsx'
import { Info, SourceMark } from '../../components/UI.tsx'
import { RegistryFacts } from './RegistryFacts.tsx'

const TIMELINE_SHOWN = 8

/** The summary: registry facts, one tile per feed, the run log and DefiLlama's figures. */
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

  return (
    <div className="two">
      <div className="stack">
        <section className="card">
          <div className="card-h">
            <h2>Protocol overview</h2>
            <Prov kind="meta" />
            <span className="aside">defi-dna registry</span>
          </div>
          <div className="card-b">
            {protocol.description ? <p className="desc">{protocol.description}</p> : null}
            <RegistryFacts protocol={protocol} versions={versions} />
          </div>
        </section>

        <section className="card">
          <div className="card-h">
            <h2>Data coverage</h2>
            <Prov kind="cov" />
            <span className="aside">
              <CoverageRing states={summary.tones} size={26} />
              <span>
                {summary.withData.length} of {feeds.length} connected feeds publish data about{' '}
                {protocol.name}
              </span>
              <Link className="text-link" to={`${base}/risk`}>
                Open risk intelligence →
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
              Quoted text is each feed’s own headline. Status colour is positioned on that feed’s
              own scale; neutral where the scale gives no reading.
            </span>
            <span>No data ≠ no risk</span>
          </div>
        </section>

        <section className="card">
          <div className="card-h">
            <h2>Latest changes</h2>
            <Prov kind="cov" />
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
      </div>

      <aside className="stack">
        <section className="card">
          <div className="card-h">
            <h2>Key figures</h2>
            <Prov kind="meta">Meta · DefiLlama</Prov>
          </div>
          <div className="card-b kv-body">
            <dl className="kv">
              <div>
                <dt>
                  TVL
                  <Info label="What this figure is">
                    The Ethereum-mainnet figure DefiLlama publishes for this version. A measured
                    quantity, not a risk rating, and never combined with what a feed says.
                  </Info>
                </dt>
                <dd>
                  {formatUsd(tvl?.value) ?? '—'}
                  <small>Ethereum mainnet</small>
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
            </dl>
          </div>
          <div className="card-f">
            <span>
              {record.metrics
                ? `DefiLlama · collected ${dateInfo(tvl?.fetchedAt).label}`
                : 'DefiLlama’s figures could not be loaded'}
            </span>
            <Link className="text-link" to={`${base}/data`}>
              All figures →
            </Link>
          </div>
        </section>

        <section className="card">
          <div className="card-h">
            <h2>How to read this page</h2>
          </div>
          <div className="card-b legend-list">
            <div>
              <Prov kind="meta" />
              <span>Facts about the protocol: our registry, and what DefiLlama measures.</span>
            </div>
            <div>
              <Prov kind="cov" />
              <span>Which feeds have published anything about {protocol.name}, and when.</span>
            </div>
            <div>
              <Prov kind="src" />
              <span>Published by a named source. Shown as-is, with its date and a link.</span>
            </div>
            <div>
              <Prov kind="cp" />
              <span>
                Written by defi-dna about <i>our data</i> — scope, gaps, failures, and the reading a
                feed’s own scale gives. Never a verdict of ours on the protocol.
              </span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  )
}
