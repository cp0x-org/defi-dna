import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { IndexBundle } from '@defi-dna/data'
import { useChangelog, useProtocol } from '../../data/useData.ts'
import { TVL_METRIC, feeds, protocolById, protocols } from '../../shared/lib/registry.ts'
import { summarizeRecord } from './record.ts'
import { changesFor } from '../dashboard/rows.ts'
import { ageLabel, categoryLabel, formatUsd } from '../../shared/lib/view.ts'
import { IconArrow } from '../../shared/ui/Icons.tsx'
import { LoadState } from '../../shared/ui/LoadState.tsx'
import { ExternalLink, ProtocolAvatar } from '../../shared/ui/UI.tsx'
import { GovernanceTab } from './GovernanceTab.tsx'
import { OverviewTab } from './OverviewTab.tsx'
import { RiskIntelligence } from './RiskIntelligence.tsx'

const REGISTRY_URL = 'https://github.com/cp0x-org/defi-dna/blob/main/registry/protocols.json'

const TABS = {
  overview: {
    label: 'Overview',
    hint: 'A summary for investigation — every feed is one click away',
  },
  governance: {
    label: 'Governance',
    hint: 'Who decides and how fast, as the contracts report it on-chain, plus what DefiLlama measures — no feed opinions here',
  },
  risk: { label: 'Risk intelligence', hint: 'Read each feed in its own words' },
} as const
type Tab = keyof typeof TABS

/** The tab's former path; links to it keep working. */
const TAB_ALIASES: Record<string, Tab> = { data: 'governance' }

/**
 * One protocol version. The heading comes from the hand-maintained registry
 * and always renders; the TVL beside it and everything below come from the
 * generated record and wait for it. Three tabs: a summary, the protocol's own
 * facts, and every feed in its own words.
 */
export const ProtocolPage = ({ index }: { index: IndexBundle | null }) => {
  const { id = '', tab: tabParam = '', feed: feedParam = '' } = useParams()
  const protocol = protocolById(id)
  const { data: record, error, retry } = useProtocol(id)
  const changelog = useChangelog()
  const anchor = useRef<HTMLDivElement>(null)
  const tab: Tab = Object.hasOwn(TABS, tabParam)
    ? (tabParam as Tab)
    : (TAB_ALIASES[tabParam] ?? 'overview')

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
  const metricsMissing = record != null && record.metrics === null
  const tvl = record?.metrics?.[TVL_METRIC]
  const tvlAge = ageLabel(tvl?.fetchedAt)
  const changes = changesFor(changelog.data ?? [], protocol.id)

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
                  <span className="lbl">Protocol versions</span>
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
        {/* The one figure worth the header: size, as DefiLlama measures it. Not a rating. */}
        <div className="id-figure">
          <span className="lbl">TVL</span>
          <b className="mono">{formatUsd(tvl?.value) ?? '—'}</b>
          <small>
            {metricsMissing
              ? 'DefiLlama · could not be loaded'
              : `DefiLlama · Ethereum${tvlAge ? ` · data cut ${tvlAge} ago` : ''}`}
          </small>
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
          <ExternalLink className="linkbtn" href={REGISTRY_URL}>
            Suggest an edit
          </ExternalLink>
        </div>
      </section>

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
      ) : tab === 'governance' ? (
        <GovernanceTab protocol={protocol} record={record} />
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
        <Link to="/sources#contribute" className="text-link">
          Send a correction <IconArrow />
        </Link>
      </div>
    </div>
  )
}
