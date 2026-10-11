import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Change, IndexBundle, Protocol, ProtocolDetail } from '@defi-dna/data'
import { useChangelog, useProtocol } from '../hooks/useIndex.ts'
import { feeds, protocolById, protocols } from '../lib/registry.ts'
import {
  ageLabel,
  categoryLabel,
  coverageLabel,
  dateInfo,
  formatUsd,
  safeUrl,
} from '../lib/view.ts'
import { CoverageRing, Prov, StatusDot, StatusPill, type Status } from '../components/Coverage.tsx'
import { IncidentsExtra, TvlComponentsExtra } from '../components/extra/MetricExtras.tsx'
import { TextExtra } from '../components/extra/TextExtra.tsx'
import { IconArrow } from '../components/Icons.tsx'
import { RiskIntelligence } from '../components/RiskIntelligence.tsx'
import { ExternalLink, Info, ProtocolAvatar, SourceMark } from '../components/UI.tsx'

const REGISTRY_URL = 'https://github.com/cp0x-org/defi-dna/blob/main/registry/protocols.json'
const TIMELINE_SHOWN = 8

const TABS = {
  overview: {
    label: 'Overview',
    hint: 'A summary for investigation — every feed is one click away',
  },
  data: {
    label: 'Protocol data',
    hint: 'What the protocol is and what DefiLlama measures — no feed opinions here',
  },
  risk: { label: 'Risk intelligence', hint: 'Read each feed in its own words' },
} as const
type Tab = keyof typeof TABS

const hostOf = (url?: string): string | null => {
  const safe = safeUrl(url)
  return safe ? new URL(safe).host.replace(/^www\./, '') : null
}

/** `11 Oct` and `13:15 UTC`, for the change timeline. */
const dayAndTime = (ts: string): [string, string] => {
  const date = new Date(ts)
  return [
    date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    `${date.toISOString().slice(11, 16)} UTC`,
  ]
}

/** What stands in for anything that needs the generated record. */
const RecordState = ({ protocol, error }: { protocol: Protocol; error: string | null }) =>
  error ? (
    <div className="empty-state" role="alert">
      <h3>What the feeds publish about {protocol.name} could not be loaded</h3>
      <p>
        Nothing is shown until it is. A missing card here means missing data, not a missing risk.
      </p>
      <button className="button primary" onClick={() => window.location.reload()}>
        Try again
      </button>
      <details>
        <summary>Technical details</summary>
        <p>{error}</p>
      </details>
    </div>
  ) : (
    <div className="empty-state" role="status">
      <h3>Loading what the feeds publish…</h3>
      <div className="loading-track" />
    </div>
  )

/**
 * One protocol version. The heading comes from the hand-maintained registry
 * and always renders; everything else comes from the generated record and
 * waits for it. Three tabs: a summary, the protocol's own facts, and every
 * feed in its own words.
 */
export const ProtocolPage = ({ index }: { index: IndexBundle | null }) => {
  const { id = '', tab: tabParam = '', feed: feedParam = '' } = useParams()
  const protocol = protocolById(id)
  const { data: record, error } = useProtocol(id)
  const changelog = useChangelog()
  const anchor = useRef<HTMLDivElement>(null)
  const tab: Tab = Object.hasOwn(TABS, tabParam) ? (tabParam as Tab) : 'overview'

  // A tab or feed picked below the fold brings the reader back up to the tabs, not the page top.
  useEffect(() => {
    if (tabParam && anchor.current && anchor.current.getBoundingClientRect().top < 0) {
      anchor.current.scrollIntoView({ block: 'start' })
    }
  }, [tabParam, feedParam])

  if (!protocol) {
    return (
      <div className="empty-state page-empty">
        <h1>Protocol not found</h1>
        <p>Nothing in the registry has the id “{id}”.</p>
        <Link to="/" className="button primary">
          Back to the protocols <IconArrow />
        </Link>
      </div>
    )
  }

  const base = `/protocol/${protocol.id}`
  const versions = protocol.group
    ? protocols.filter((other) => other.group === protocol.group)
    : [protocol]
  const statusOf = (feedId: string): Status | null =>
    record ? (record.feeds[feedId]?.status ?? 'none') : null
  const withData = feeds.filter((feed) => statusOf(feed.id) === 'ok')
  const errors = feeds.filter((feed) => statusOf(feed.id) === 'error')
  const tvl = record?.metrics['tvl']
  const incidents = record?.metrics['incidents']
  const latestIncident = [...(incidents?.extra?.incidents ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0]
  const lastChange = feeds
    .map((feed) => ({ feed, since: record?.feeds[feed.id]?.since }))
    .filter((entry) => entry.since && statusOf(entry.feed.id) === 'ok')
    .sort((a, b) => (b.since ?? '').localeCompare(a.since ?? ''))[0]
  const changes = (changelog.data ?? []).filter((change) => change.protocolId === protocol.id)

  const figure = (label: ReactNode, value: ReactNode, sub: ReactNode, to?: string): ReactNode => {
    const body = (
      <>
        <div className="m-l">{label}</div>
        <div className="m-v">{value}</div>
        <div className="m-s">{sub}</div>
      </>
    )
    return to ? (
      <Link className="m" to={to}>
        {body}
      </Link>
    ) : (
      <div className="m">{body}</div>
    )
  }

  return (
    <div className="page protocol-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Protocols</Link>
        <span>/</span>
        {protocol.group ? (
          <>
            <span>{protocol.group}</span>
            <span>/</span>
          </>
        ) : null}
        <span aria-current="page">{protocol.name}</span>
      </nav>

      <section className="identity">
        <div className="id-left">
          <ProtocolAvatar id={protocol.id} name={protocol.name} large />
          <div>
            <div className="id-title">
              <h1>{protocol.name}</h1>
              <Prov kind="meta" title="Protocol facts from the defi-dna registry" />
            </div>
            <div className="id-sub">
              <b>{categoryLabel(protocol.category)}</b>
              {protocol.description ? ` · ${protocol.description}` : ''}
            </div>
            <div className="id-chains">
              <span className="lbl">Network</span>
              <span className="tag">Ethereum mainnet</span>
              {versions.length > 1 ? (
                <>
                  <span className="lbl">Versions</span>
                  {versions.map((version) =>
                    version.id === protocol.id ? (
                      <span className="tag on" key={version.id} aria-current="page">
                        {version.name}
                      </span>
                    ) : (
                      <Link className="tag" key={version.id} to={`/protocol/${version.id}`}>
                        {version.name}
                      </Link>
                    ),
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="id-links">
          {protocol.website ? (
            <ExternalLink className="linkbtn" href={protocol.website}>
              Website
            </ExternalLink>
          ) : null}
          {tvl?.url ? (
            <ExternalLink className="linkbtn" href={tvl.url}>
              DefiLlama
            </ExternalLink>
          ) : null}
        </div>
      </section>

      <section className="mstrip" aria-label="Key figures">
        {figure(
          <>
            TVL <Prov kind="meta" />
          </>,
          formatUsd(tvl?.value) ?? '—',
          tvl ? `DefiLlama · Ethereum · ${ageLabel(tvl.fetchedAt) ?? '—'} ago` : 'DefiLlama',
        )}
        {figure(
          <>
            Category <Prov kind="meta" />
          </>,
          categoryLabel(protocol.category),
          'registry',
        )}
        {figure(
          <>
            Network <Prov kind="meta" />
          </>,
          'Ethereum',
          'mainnet only',
        )}
        {figure(
          <>
            Coverage <Prov kind="cov">Cov</Prov>
          </>,
          record ? (
            <>
              {withData.length} <small>/ {feeds.length}</small>
            </>
          ) : (
            '—'
          ),
          'feeds with data',
          `${base}/risk`,
        )}
        {figure(
          <>
            Incidents <Prov kind="src">Src</Prov>
          </>,
          incidents?.value != null ? (
            <>
              {incidents.value} <small>recorded</small>
            </>
          ) : (
            '—'
          ),
          latestIncident
            ? `DefiLlama · latest ${dateInfo(latestIncident.date).label}`
            : 'DefiLlama',
          `${base}/data`,
        )}
        {figure(
          <>
            Changed <Prov kind="cov">Cov</Prov>
          </>,
          lastChange ? (
            <>
              {ageLabel(lastChange.since)} <small>ago</small>
            </>
          ) : (
            '—'
          ),
          lastChange ? `${lastChange.feed.name} changed` : 'latest move in a feed’s value',
        )}
      </section>

      {record ? (
        <section className="covblock" aria-label="Feed coverage">
          <div className="cov-head">
            <Prov kind="cov">Data coverage</Prov>
            <span className="ttl">
              <b>
                {withData.length} / {feeds.length}
              </b>{' '}
              feeds with data
            </span>
            <span className="cov-legend">
              <span>
                <StatusDot status="ok" />
                {withData.length} data available
              </span>
              <span>
                <StatusDot status="none" />
                {feeds.length - withData.length - errors.length} no data
              </span>
              {errors.length > 0 ? (
                <span>
                  <StatusDot status="error" />
                  {errors.length} collection error
                </span>
              ) : null}
            </span>
            <span className="note">
              Colour = whether a feed publishes data we could collect, never what it says. Click a
              feed to read it.
            </span>
          </div>
          <div
            className="covsegs"
            style={{ gridTemplateColumns: `repeat(${feeds.length}, minmax(0, 1fr))` }}
          >
            {feeds.map((feed) => {
              const status = statusOf(feed.id) ?? 'none'
              const updated = record.feeds[feed.id]?.updatedAt
              return (
                <Link
                  key={feed.id}
                  className={`cseg st-${status}`}
                  to={`${base}/risk/${feed.id}`}
                  title={`${feed.name} — ${coverageLabel(status)}`}
                >
                  <i />
                  <span>{feed.name}</span>
                  <small>
                    {coverageLabel(status)}
                    {status === 'ok' && updated ? ` · ${dateInfo(updated).label}` : ''}
                  </small>
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}

      <div className="tabs-anchor" ref={anchor} />
      <nav className="tabs" aria-label="Protocol sections">
        {(Object.keys(TABS) as Tab[]).map((key) => (
          <Link
            key={key}
            to={key === 'overview' ? base : `${base}/${key}`}
            className={tab === key ? 'on' : undefined}
            aria-current={tab === key ? 'page' : undefined}
          >
            {TABS[key].label}
            {key === 'risk' && record ? (
              <span className="cnt">
                {withData.length} / {feeds.length}
              </span>
            ) : null}
          </Link>
        ))}
        <span className="hint">{TABS[tab].hint}</span>
      </nav>

      {!record ? (
        <RecordState protocol={protocol} error={error} />
      ) : tab === 'risk' ? (
        <RiskIntelligence protocol={protocol} record={record} index={index} feedId={feedParam} />
      ) : tab === 'data' ? (
        <DataTab protocol={protocol} record={record} versions={versions} />
      ) : (
        <OverviewTab
          protocol={protocol}
          record={record}
          versions={versions}
          changes={changes}
          changelogError={changelog.error}
          changelogLoading={!changelog.data && !changelog.error}
        />
      )}

      <div className="page-end-note">
        <span>Spotted an outdated value or a missing feed?</span>
        <Link to="/methodology#contribute" className="text-link">
          Send a correction <IconArrow />
        </Link>
      </div>
    </div>
  )
}

const RegistryFacts = ({
  protocol,
  versions,
  className = 'facts',
}: {
  protocol: Protocol
  versions: Protocol[]
  className?: string
}) => (
  <dl className={className}>
    <div>
      <dt>Name</dt>
      <dd>{protocol.name}</dd>
    </div>
    <div>
      <dt>Protocol</dt>
      <dd>{protocol.group ?? protocol.name}</dd>
    </div>
    <div>
      <dt>Category</dt>
      <dd>{categoryLabel(protocol.category)}</dd>
    </div>
    <div>
      <dt>Network</dt>
      <dd>Ethereum mainnet</dd>
    </div>
    <div>
      <dt>Versions tracked</dt>
      <dd>{versions.length}</dd>
    </div>
    <div>
      <dt>Registry id</dt>
      <dd className="mono">{protocol.id}</dd>
    </div>
    {protocol.website ? (
      <div>
        <dt>Website</dt>
        <dd>
          <ExternalLink href={protocol.website}>{hostOf(protocol.website)}</ExternalLink>
        </dd>
      </div>
    ) : null}
  </dl>
)

const OverviewTab = ({
  protocol,
  record,
  versions,
  changes,
  changelogError,
  changelogLoading,
}: {
  protocol: Protocol
  record: ProtocolDetail
  versions: Protocol[]
  changes: Change[]
  changelogError: string | null
  changelogLoading: boolean
}) => {
  const base = `/protocol/${protocol.id}`
  const states = feeds.map((feed) => record.feeds[feed.id]?.status ?? 'none')
  const withData = states.filter((status) => status === 'ok').length
  const tvl = record.metrics['tvl']
  const incidents = record.metrics['incidents']
  const latestIncident = [...(incidents?.extra?.incidents ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0]
  const feedName = (id: string) => feeds.find((feed) => feed.id === id)?.name ?? id

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
              <CoverageRing states={states} size={26} />
              <span>
                {withData} of {feeds.length} connected feeds publish data about {protocol.name}
              </span>
              <Link className="text-link" to={`${base}/risk`}>
                Open risk intelligence →
              </Link>
            </span>
          </div>
          <div className="card-b">
            <div className="ftiles">
              {feeds.map((feed) => {
                const data = record.feeds[feed.id]
                const status = data?.status ?? 'none'
                return (
                  <Link
                    key={feed.id}
                    className={`ftile st-${status}`}
                    to={`${base}/risk/${feed.id}`}
                  >
                    <span className="ft-top">
                      <SourceMark id={feed.id} />
                      <b>{feed.name}</b>
                      <StatusPill status={status} />
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
              Quoted text is each feed’s own headline, as published. Check what a feed assesses
              before comparing two.
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
                  {latestIncident ? dateInfo(latestIncident.date).label : '—'}
                  {latestIncident ? <small>{latestIncident.classification}</small> : null}
                </dd>
              </div>
            </dl>
          </div>
          <div className="card-f">
            <span>DefiLlama · collected {dateInfo(tvl?.fetchedAt).label}</span>
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
                Written by defi-dna about <i>our data</i> — scope, gaps, failures. Never a verdict
                on the protocol.
              </span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  )
}

const DataTab = ({
  protocol,
  record,
  versions,
}: {
  protocol: Protocol
  record: ProtocolDetail
  versions: Protocol[]
}) => {
  const tvl = record.metrics['tvl']
  const incidents = record.metrics['incidents']
  const feedLinks = feeds.filter(
    (feed) => record.feeds[feed.id]?.status === 'ok' && record.feeds[feed.id]?.url,
  )

  return (
    <>
      <div className="row2">
        <section className="card">
          <div className="card-h">
            <h2>Protocol metadata</h2>
            <Prov kind="meta" />
            <span className="aside">
              registry · <ExternalLink href={REGISTRY_URL}>Suggest an edit</ExternalLink>
            </span>
          </div>
          <div className="card-b">
            {protocol.description ? <p className="desc">{protocol.description}</p> : null}
            <RegistryFacts protocol={protocol} versions={versions} className="facts three" />
          </div>
        </section>
        <section className="card">
          <div className="card-h">
            <h2>TVL</h2>
            <Prov kind="meta" />
            <span className="aside">via DefiLlama · {dateInfo(tvl?.fetchedAt).label}</span>
          </div>
          <div className="card-b">
            <div className="tvl-big">{formatUsd(tvl?.value) ?? 'Not available'}</div>
            <p className="tvl-note">
              The Ethereum-mainnet figure, as DefiLlama publishes it. A measured quantity — never
              combined with what a feed says.
            </p>
            <TvlComponentsExtra components={tvl?.extra?.components} />
            <TextExtra text={tvl?.extra?.text} />
          </div>
        </section>
      </div>

      <div className="row2">
        <section className="card" id="incidents">
          <div className="card-h">
            <h2>Incidents</h2>
            <Prov kind="src" />
            <span className="aside">recorded by DefiLlama</span>
          </div>
          <div className="card-b">
            {incidents ? (
              <>
                <IncidentsExtra incidents={incidents.extra?.incidents ?? []} />
                <TextExtra text={incidents.extra?.text} />
              </>
            ) : (
              <p className="muted">DefiLlama’s incident list was not collected for this version.</p>
            )}
          </div>
          <div className="card-f">
            <span>
              {incidents?.note ??
                'Attributing an incident to a protocol is DefiLlama’s call. defi-dna does not verify, classify or score incidents.'}
            </span>
            {incidents?.url ? (
              <ExternalLink href={incidents.url}>DefiLlama hacks</ExternalLink>
            ) : null}
          </div>
        </section>
        <section className="card">
          <div className="card-h">
            <h2>Links</h2>
            <Prov kind="meta" />
          </div>
          <div className="card-b links-list">
            {protocol.website ? (
              <ExternalLink className="link-row" href={protocol.website}>
                <b>Website</b>
                <span>{hostOf(protocol.website)}</span>
              </ExternalLink>
            ) : null}
            {tvl?.url ? (
              <ExternalLink className="link-row" href={tvl.url}>
                <b>DefiLlama</b>
                <span>{hostOf(tvl.url)}</span>
              </ExternalLink>
            ) : null}
            {feedLinks.map((feed) => (
              <ExternalLink className="link-row" key={feed.id} href={record.feeds[feed.id]?.url}>
                <b>{feed.name}</b>
                <span>{hostOf(record.feeds[feed.id]?.url)}</span>
              </ExternalLink>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
