import { Link, useParams } from 'react-router-dom'
import { useProtocol } from '../hooks/useIndex.ts'
import { feeds as allFeeds, metricById, protocolById, protocols } from '../lib/registry.ts'
import { categoryLabel, dateInfo, formatUsd } from '../lib/view.ts'
import { FeedAssessment } from '../components/FeedAssessment.tsx'
import { IncidentsExtra, TvlComponentsExtra } from '../components/extra/MetricExtras.tsx'
import { TextExtra } from '../components/extra/TextExtra.tsx'
import { IconArrow } from '../components/Icons.tsx'
import { DataAgeHelp, ExternalLink, Info, ProtocolAvatar } from '../components/UI.tsx'

const tvlLabel = metricById('tvl')?.name ?? 'DefiLlama · Ethereum TVL'
const incidentsLabel = metricById('incidents')?.name ?? 'DefiLlama · Incident history'

export const ProtocolPage = () => {
  const { id = '' } = useParams()
  const protocol = protocolById(id)
  const { data, error } = useProtocol(id)

  if (!protocol) {
    return (
      <div className="empty-state page-empty">
        <h1>Protocol not found</h1>
        <p>Nothing in the registry has the id “{id}”.</p>
        <Link to="/" className="button primary">
          Back to the matrix <IconArrow />
        </Link>
      </div>
    )
  }
  if (error) {
    return (
      <div className="empty-state page-empty">
        <h1>Protocol not found</h1>
        <p>{error}</p>
        <Link to="/" className="button primary">
          Back to the matrix <IconArrow />
        </Link>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="empty-state page-empty" role="status">
        <h1>Loading {id}…</h1>
        <div className="loading-track" />
      </div>
    )
  }

  const { metrics, feeds } = data
  const siblings = protocols.filter(
    (other) => protocol.group && other.group === protocol.group && other.id !== protocol.id,
  )
  const tvl = metrics['tvl']
  const incidents = metrics['incidents']

  const withData = allFeeds.filter((feed) => feeds[feed.id]?.status === 'ok')
  const missing = allFeeds.filter((feed) => feeds[feed.id] && feeds[feed.id]?.status !== 'ok')

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Matrix</Link>
        <span>/</span>
        <span aria-current="page">{protocol.name}</span>
      </nav>

      <section className="protocol-heading">
        <div className="protocol-identity">
          <ProtocolAvatar id={protocol.id} name={protocol.name} large />
          <div>
            <span className="eyebrow">
              {protocol.group ? `${protocol.group} · ` : ''}
              {categoryLabel(protocol.category)} · ETHEREUM MAINNET
            </span>
            <h1>{protocol.name}</h1>
            <div className="family-tags">
              <span>{protocol.id}</span>
              {protocol.website ? (
                <ExternalLink href={protocol.website} className="outline-badge">
                  Website
                </ExternalLink>
              ) : null}
            </div>
          </div>
        </div>
        <Link to="/sources" className="button secondary">
          About the feeds <IconArrow />
        </Link>
      </section>

      {protocol.description ? (
        <p className="muted" style={{ maxWidth: '68ch', marginBottom: 20 }}>
          {protocol.description}
        </p>
      ) : null}

      <div className="protocol-summary">
        <div>
          <span className="summary-label">
            {tvlLabel}
            <Info label="What this figure is">
              A measured quantity published by DefiLlama for this protocol, not a risk rating. It is
              never combined with what a feed says.
            </Info>
          </span>
          <strong>{formatUsd(tvl?.value) ?? 'Not available'}</strong>
          <small>Collected {dateInfo(tvl?.fetchedAt).label}</small>
        </div>
        <div>
          <span className="summary-label">
            Feeds with data
            <Info label="About coverage">
              A feed may assess the protocol, one of its deployments, or the vaults inside it — and
              it does not always say which. More data does not imply a safer protocol.
            </Info>
          </span>
          <strong>
            {withData.length}
            <span className="summary-total"> / {allFeeds.length}</span>
          </strong>
          <small>
            {missing.length
              ? `${missing.length} feed${missing.length === 1 ? '' : 's'} without data here`
              : 'Check the scope of each assessment'}
          </small>
        </div>
        <div className="summary-guidance">
          <span className="eyebrow">WHERE TO START</span>
          <p>
            {withData.length
              ? 'Read the cards below. Where two feeds disagree, both are shown — we do not resolve it.'
              : 'No feed we track publishes data here yet. That is a gap in coverage, not a verdict.'}
          </p>
          <a href="#assessments" className="text-link">
            {withData.length ? 'Go to the assessments' : 'See the gaps'} <IconArrow />
          </a>
        </div>
      </div>

      <nav className="section-nav" aria-label="On this page">
        <a href="#assessments">
          Assessments <span>{withData.length}</span>
        </a>
        <a href="#incidents">Incidents</a>
        <Link to="/methodology">Reading guide</Link>
      </nav>

      <section id="assessments" className="assessment-section">
        <div className="section-heading">
          <div>
            <h2>What the feeds publish</h2>
            <p>Their words, their scales, their scopes.</p>
          </div>
          <span className="section-aside">
            Feed assessment dates
            <DataAgeHelp />
          </span>
        </div>

        {withData.length === 0 && (
          <div className="coverage-notice">
            <strong>No data collected yet</strong>
            <span>
              We track {protocol.name}, but no feed in the registry publishes something we could map
              to it. This establishes nothing about whether it is safe.
            </span>
          </div>
        )}

        <div className="assessment-grid">
          {withData.map((feed) => {
            const observation = feeds[feed.id]
            return observation ? (
              <FeedAssessment key={feed.id} feed={feed} data={observation} />
            ) : null
          })}
        </div>

        {missing.length > 0 && (
          <div className="coverage-gaps">
            <h3>
              Coverage gaps <span className="count-badge">{missing.length}</span>
              <Info label="Why a feed may be missing">
                A gap can mean the feed does not cover this protocol, covers it under a scope we
                have not mapped, or that our pipeline failed. Those are different things and the
                card says which.
              </Info>
            </h3>
            <div className="gap-grid">
              {missing.map((feed) => {
                const observation = feeds[feed.id]
                return observation ? (
                  <FeedAssessment key={feed.id} feed={feed} data={observation} />
                ) : null
              })}
            </div>
          </div>
        )}
      </section>

      {tvl?.extra?.components?.length || tvl?.extra?.text?.length ? (
        <section className="context-section" aria-label="Additional DefiLlama TVL data">
          <TvlComponentsExtra components={tvl.extra.components} />
          <TextExtra text={tvl.extra.text} />
        </section>
      ) : null}

      <section id="incidents" className="context-section">
        <div className="section-heading">
          <div>
            <h2>{incidentsLabel}</h2>
            <p>Reported incidents — separate from the assessments above.</p>
          </div>
          <Info label="About this section">
            Incident history is what DefiLlama attributes to this protocol id. Absence from their
            registry is not proof that nothing happened.
          </Info>
        </div>

        <IncidentsExtra incidents={incidents?.extra?.incidents} note={incidents?.note} />
        <TextExtra text={incidents?.extra?.text} />
      </section>

      {siblings.length > 0 ? (
        <p className="sibling-line">
          Other {protocol.group} versions:{' '}
          {siblings.map((sibling, position) => (
            <span key={sibling.id}>
              {position > 0 ? ' · ' : ''}
              <Link to={`/protocol/${sibling.id}`}>{sibling.name}</Link>
            </span>
          ))}
          . Each is collected on its own — nothing is carried across versions.
        </p>
      ) : null}

      <div className="page-end-note">
        <span>Spotted an outdated value or a missing feed?</span>
        <Link to="/methodology#contribute" className="text-link">
          Send a correction <IconArrow />
        </Link>
      </div>
    </>
  )
}
