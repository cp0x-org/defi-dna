import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { IndexBundle } from '@defi-dna/data'
import { useChangelog, useProtocol } from '../hooks/useIndex.ts'
import {
  INCIDENTS_METRIC,
  TVL_METRIC,
  feedName,
  feeds,
  protocolById,
  protocols,
} from '../lib/registry.ts'
import { summarizeRecord } from '../lib/record.ts'
import { changesFor } from '../lib/rows.ts'
import { ageLabel, categoryLabel, dateInfo, formatUsd } from '../lib/view.ts'
import {
  LEGEND_SIGNALS,
  SIGNAL_LABELS,
  SIGNAL_TONES,
  TONE_LABELS,
  signalCounts,
} from '../lib/status.ts'
import { Prov, StatusDot } from '../components/Coverage.tsx'
import { IconArrow } from '../components/Icons.tsx'
import { LoadState } from '../components/LoadState.tsx'
import { ExternalLink, ProtocolAvatar } from '../components/UI.tsx'
import { DataTab } from './protocol/DataTab.tsx'
import { OverviewTab } from './protocol/OverviewTab.tsx'
import { RiskIntelligence } from './protocol/RiskIntelligence.tsx'

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

/**
 * One protocol version. The heading comes from the hand-maintained registry
 * and always renders; everything else comes from the generated record and
 * waits for it. Three tabs: a summary, the protocol's own facts, and every
 * feed in its own words.
 */
export const ProtocolPage = ({ index }: { index: IndexBundle | null }) => {
  const { id = '', tab: tabParam = '', feed: feedParam = '' } = useParams()
  const protocol = protocolById(id)
  const { data: record, error, retry } = useProtocol(id)
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
  const summary = record ? summarizeRecord(record) : null
  const signals = signalCounts(summary?.tones ?? [])
  const metricsMissing = record != null && record.metrics === null
  const tvl = record?.metrics?.[TVL_METRIC]
  const incidents = record?.metrics?.[INCIDENTS_METRIC]
  const tvlAge = ageLabel(tvl?.fetchedAt)
  const latestIncident = summary?.latestIncident
  const changes = changesFor(changelog.data ?? [], protocol.id)
  const lastChange = changes[0]

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
          metricsMissing
            ? 'DefiLlama · could not be loaded'
            : `DefiLlama · Ethereum${tvlAge ? ` · ${tvlAge} ago` : ''}`,
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
          summary ? (
            <>
              {summary.withData.length} <small>/ {feeds.length}</small>
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
          metricsMissing
            ? 'DefiLlama · could not be loaded'
            : latestIncident
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
              {ageLabel(lastChange.ts)} <small>ago</small>
            </>
          ) : (
            '—'
          ),
          changelog.error
            ? 'run log could not be loaded'
            : lastChange
              ? `${feedName(lastChange.feedId)} changed`
              : 'latest move in a feed’s value',
        )}
      </section>

      {record && summary ? (
        <section className="covblock" aria-label="Feed coverage">
          <div className="cov-head">
            <Prov kind="cov">Data coverage</Prov>
            <span className="ttl">
              <b>
                {summary.withData.length} / {feeds.length}
              </b>{' '}
              feeds with data
            </span>
            <span className="cov-legend">
              {LEGEND_SIGNALS.map((signal) => (
                <span key={signal}>
                  <StatusDot tone={SIGNAL_TONES[signal]} />
                  {signals[signal]} {SIGNAL_LABELS[signal].toLowerCase()}
                </span>
              ))}
              <span>
                <StatusDot tone="none" />
                {feeds.length - summary.withData.length - summary.errors.length} no data
              </span>
              {summary.errors.length > 0 ? (
                <span>
                  <StatusDot tone="error" />
                  {summary.errors.length} collection error
                </span>
              ) : null}
            </span>
            <span className="note">
              Colour = the feed’s own characterization, on its own scale. Click a feed to read it.
            </span>
          </div>
          <div className="covsegs" style={{ '--feeds': feeds.length } as CSSProperties}>
            {feeds.map((feed, k) => {
              const tone = summary.tones[k] ?? 'none'
              const updated = record.feeds[feed.id]?.updatedAt
              return (
                <Link
                  key={feed.id}
                  className={`cseg st-${tone}`}
                  to={`${base}/risk/${feed.id}`}
                  title={`${feed.name} — ${TONE_LABELS[tone]}`}
                >
                  <i />
                  <span>{feed.name}</span>
                  <small>
                    {TONE_LABELS[tone]}
                    {record.feeds[feed.id]?.status === 'ok' && updated
                      ? ` · ${dateInfo(updated).label}`
                      : ''}
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
            {key === 'risk' && summary ? (
              <span className="cnt">
                {summary.withData.length} / {feeds.length}
              </span>
            ) : null}
          </Link>
        ))}
        <span className="hint">{TABS[tab].hint}</span>
      </nav>

      {!record || !summary ? (
        <LoadState
          error={error}
          onRetry={retry}
          failed={`What the feeds publish about ${protocol.name} could not be loaded`}
          loading="Loading what the feeds publish…"
        >
          Nothing is shown until it is. A missing card here means missing data, not a missing risk.
        </LoadState>
      ) : tab === 'risk' ? (
        <RiskIntelligence
          protocol={protocol}
          record={record}
          summary={summary}
          index={index}
          feedId={feedParam}
        />
      ) : tab === 'data' ? (
        <DataTab protocol={protocol} record={record} versions={versions} />
      ) : (
        <OverviewTab
          protocol={protocol}
          record={record}
          versions={versions}
          summary={summary}
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
