import { Link } from 'react-router-dom'
import type { IndexBundle } from '@defi-dna/data'
import { feeds, metrics } from '../lib/registry.ts'
import { IconArrow, IconChevron } from '../components/Icons.tsx'
import { ExternalLink, SourceMark } from '../components/UI.tsx'

export const SourcesPage = ({ index }: { index: IndexBundle }) => (
  <>
    <section className="page-intro">
      <span className="eyebrow">THE FEED REGISTRY</span>
      <h1>
        Different lenses.
        <br />
        <span>Shown side by side, never merged.</span>
      </h1>
      <p>
        Each feed answers its own question on its own scale, and covers whichever protocols it chose
        to cover. Knowing which question a feed asks — and where its coverage stops — is most of the
        work of reading this site.
      </p>
    </section>

    <div className="directory-grid">
      {feeds.map((feed) => {
        const covered = index.rows.filter((row) => row.feeds[feed.id]).length
        return (
          <article className="directory-card" key={feed.id} id={`feed-${feed.id}`} tabIndex={-1}>
            <div className="directory-heading">
              <SourceMark id={feed.id} />
              <span className="outline-badge">
                {covered} / {index.rows.length} versions
              </span>
            </div>
            <h2>{feed.name}</h2>
            <span className="source-topic">{feed.topic}</span>
            <p>{feed.focus}</p>
            <dl className="directory-meta">
              <div>
                <dt>Coverage here</dt>
                <dd>
                  {covered} of {index.rows.length} protocol versions
                </dd>
              </div>
              <div>
                <dt>How values are shown</dt>
                <dd>Verbatim, with the feed’s own date and a link</dd>
              </div>
            </dl>
            <details className="directory-details">
              <summary>
                How to read this feed
                <IconChevron />
              </summary>
              <p>
                {feed.focus} We store what it publishes and convert nothing into another feed’s
                units — so a value here can only be compared with other values from this same feed.
              </p>
              <p className="small muted">
                Coverage describes our collection, not the feed’s whole catalogue.
              </p>
              <ExternalLink href={feed.methodologyUrl ?? feed.homepage}>
                {feed.methodologyUrl ? 'Their methodology' : 'Feed documentation'}
              </ExternalLink>
            </details>
            <div className="directory-actions">
              <Link className="text-link" to={`/?feed=${encodeURIComponent(feed.id)}`}>
                See this column <IconArrow />
              </Link>
              <ExternalLink href={feed.homepage}>Website</ExternalLink>
            </div>
          </article>
        )
      })}
    </div>

    <section className="reading-strip" style={{ marginTop: 40 }}>
      <div>
        <h2>Independent does not mean interchangeable.</h2>
        <p>
          The same protocol gets different assessments because the feeds ask different questions —
          and sometimes about different things entirely: a protocol, one of its deployments, or the
          vaults inside it. We show the difference rather than averaging it away.
        </p>
      </div>
      <Link to="/methodology" className="button secondary">
        Reading guide <IconArrow />
      </Link>
    </section>

    <section style={{ marginTop: 40 }}>
      <div className="section-heading">
        <div>
          <h2>Independent measurements</h2>
          <p>Quantities, not verdicts — so they sit outside the feed columns.</p>
        </div>
      </div>
      <div className="table-card">
        <div className="matrix-scroll">
          <table className="registry-table">
            <thead>
              <tr>
                <th scope="col">Measurement</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.id}>
                  <td>{metric.name}</td>
                  <td>
                    <ExternalLink href={metric.homepage}>
                      {metric.homepage.replace(/^https?:\/\//, '')}
                    </ExternalLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <div className="page-end-note">
      <span>A feed we should add?</span>
      <Link to="/methodology#contribute" className="text-link">
        How to propose one <IconArrow />
      </Link>
    </div>
  </>
)
