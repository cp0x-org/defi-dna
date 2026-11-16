import { Link } from 'react-router-dom'
import type { IndexBundle } from '@defi-dna/data'
import { EMPTY_QUERY, writeQuery } from '../dashboard/matrix.ts'
import { feeds, metrics } from '../../shared/lib/registry.ts'
import { coverageCount } from '../dashboard/rows.ts'
import { assessesLabel, dateInfo } from '../../shared/lib/view.ts'
import { IconArrow, IconChevron } from '../../shared/ui/Icons.tsx'
import { ExternalLink, SourceMark } from '../../shared/ui/UI.tsx'

const REPO = 'https://github.com/cp0x-org/defi-dna'

/** Coverage counts need the dataset; everything else here is hand-maintained. */
export const SourcesPage = ({ index }: { index: IndexBundle | null }) => (
  <>
    <section className="page-intro">
      <span className="eyebrow">THE RISK FEED REGISTRY</span>
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
        const covered = index ? coverageCount(index.rows, feed.id) : null
        const status = index?.sources?.[feed.id]
        return (
          <article className="directory-card" key={feed.id} id={`feed-${feed.id}`} tabIndex={-1}>
            <div className="directory-heading">
              <SourceMark id={feed.id} />
              <span className="outline-badge">
                {index
                  ? `${covered} / ${index.rows.length} protocol versions`
                  : '— protocol versions'}
              </span>
            </div>
            <h2>{feed.name}</h2>
            <span className="source-topic">{feed.topic}</span>
            <p>{feed.focus}</p>
            <dl className="directory-meta">
              <div>
                <dt>What it assesses</dt>
                <dd>{assessesLabel(feed.assesses)}</dd>
              </div>
              <div>
                <dt>Coverage here</dt>
                <dd>
                  {index ? `${covered} of ${index.rows.length} protocol versions` : 'Not loaded'}
                </dd>
              </div>
              <div>
                <dt>How values are shown</dt>
                <dd>Verbatim, with the feed’s own date and a link</dd>
              </div>
              <div>
                <dt>Last read without errors</dt>
                <dd>
                  {!index
                    ? 'Not loaded'
                    : status?.lastOkAt
                      ? dateInfo(status.lastOkAt).label
                      : 'Never'}
                  {status?.note ? <small className="muted"> · {status.note}</small> : null}
                </dd>
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
              <Link
                className="text-link"
                to={`/?${writeQuery({ ...EMPTY_QUERY, has: [feed.id] }).toString()}`}
              >
                See this column <IconArrow />
              </Link>
              <ExternalLink href={feed.homepage}>Website</ExternalLink>
            </div>
          </article>
        )
      })}
    </div>

    <section className="reading-strip reading-section">
      <div>
        <h2>Independent does not mean interchangeable.</h2>
        <p>
          The same protocol gets different assessments because the feeds ask different questions —
          and sometimes about different things entirely: a protocol, one of its deployments, or the
          vaults inside it. We show the difference rather than averaging it away.
        </p>
      </div>
    </section>

    <section className="reading-section">
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

    <section id="contribute" className="contribute-panel" tabIndex={-1}>
      <div>
        <span className="eyebrow">OPEN DATA, SHARED RESPONSIBILITY</span>
        <h2>Corrections are pull requests.</h2>
        <p>
          Everything on this site comes from plain JSON in a public AGPL-3.0 repository, and every
          refresh is committed — so the history of a value survives a feed editing its own page. A
          risk feed we should add, an outdated value, a missing mapping: open an issue or a pull
          request.
        </p>
      </div>
      <ExternalLink className="button secondary" href={REPO}>
        Contribute on GitHub
      </ExternalLink>
      <details className="contribute-details">
        <summary>
          For data contributors
          <IconChevron />
        </summary>
        <p>
          Protocols live in <code>registry/protocols.json</code>. A feed describes itself in{' '}
          <code>adapters/feeds/&lt;feed&gt;/feed.json</code> and maps our protocol ids to its own in{' '}
          <code>mapping.json</code> — one id per line, nothing else. A protocol a feed does not
          cover is simply absent from that mapping.
        </p>
      </details>
    </section>
  </>
)
