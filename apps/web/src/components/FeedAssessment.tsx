import type { Feed, FeedData } from '@defi-dna/data'
import { coverageLabel, dateInfo } from '../lib/view.ts'
import { IconChevron } from './Icons.tsx'
import { AssessmentDate, DataAgeHelp, ExternalLink, Info, SourceMark } from './UI.tsx'

interface Finding {
  title: string
  severity: string | null
  description: string | null
}

/** Findings, for feeds that publish them alongside their value. */
const findingsOf = (data: FeedData): Finding[] => {
  const list = data.extra?.['keyFindings']
  if (!Array.isArray(list)) return []
  return list.flatMap((entry) => {
    const finding = entry as Record<string, unknown>
    return typeof finding['title'] === 'string'
      ? [
          {
            title: finding['title'],
            severity: typeof finding['severity'] === 'string' ? finding['severity'] : null,
            description: typeof finding['description'] === 'string' ? finding['description'] : null,
          },
        ]
      : []
  })
}

/**
 * One feed's full say about one protocol.
 *
 * Everything with a value in it — the headline, the breakdown, the quote — is
 * the feed's own text. The surrounding words explain scope and provenance, and
 * never restate what the feed concluded.
 */
export const FeedAssessment = ({ feed, data }: { feed: Feed; data: FeedData }) => {
  const details = data.details ?? []
  const findings = findingsOf(data)
  const available = data.status === 'ok'

  return (
    <article
      className={`assessment-card${available ? '' : ' is-missing'}`}
      id={`feed-${feed.id}`}
      tabIndex={-1}
    >
      <div className="assessment-card-top">
        <div className="source-identity">
          <SourceMark id={feed.id} />
          <div>
            <h3>{feed.name}</h3>
            <span className="small muted">{feed.topic}</span>
          </div>
        </div>
        <span className={`coverage-badge status-${data.status}`}>{coverageLabel(data.status)}</span>
      </div>

      {available ? (
        <>
          <div className="assessment-readout">
            <span className="eyebrow">WHAT THIS FEED PUBLISHES</span>
            <div className="native-verdict">{data.value}</div>
            <div className="scope-line">
              As {feed.name} publishes it
              <Info label={`Understanding ${feed.name}`}>
                {feed.focus} Values are shown exactly as {feed.name} publishes them and are not
                converted into any other feed’s scale.
              </Info>
            </div>
          </div>

          {details.length > 0 ? (
            <dl className="dimension-preview">
              {details.slice(0, 3).map((detail) => (
                <div key={detail.name}>
                  <dt>{detail.name}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="small muted">
              Open the assessment for this feed’s own words and everything we stored.
            </p>
          )}

          <details className="assessment-details">
            <summary>
              Explore assessment
              <IconChevron />
            </summary>
            <div className="assessment-expanded">
              {data.note ? <p className="inline-note">{data.note}</p> : null}

              {data.summary ? (
                <div>
                  <h4>In {feed.name}’s words</h4>
                  <blockquote className="original-text-quote">{data.summary}</blockquote>
                </div>
              ) : null}

              {details.length > 0 ? (
                <div>
                  <h4>
                    {feed.name}’s breakdown <span className="muted">({details.length})</span>
                  </h4>
                  <div className="breakdown">
                    {details.map((detail) =>
                      detail.description ? (
                        <details className="breakdown-item" key={detail.name}>
                          <summary>
                            <span>{detail.name}</span>
                            <strong>{detail.value}</strong>
                            <IconChevron />
                          </summary>
                          <p>{detail.description}</p>
                        </details>
                      ) : (
                        <div className="breakdown-item plain" key={detail.name}>
                          <span>{detail.name}</span>
                          <strong>{detail.value}</strong>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              {findings.length > 0 ? (
                <div>
                  <h4>Findings reported by {feed.name}</h4>
                  <p className="small muted">
                    Published by the feed; they may span several networks.
                  </p>
                  <div className="findings">
                    {findings.map((finding, index) => (
                      <details key={`${finding.title}-${index}`}>
                        <summary>
                          {finding.severity ? (
                            <span className="finding-severity">{finding.severity}</span>
                          ) : null}
                          <span>{finding.title}</span>
                          <IconChevron />
                        </summary>
                        <p>{finding.description ?? 'See the original assessment for details.'}</p>
                      </details>
                    ))}
                  </div>
                </div>
              ) : null}

              <details className="original-text">
                <summary>
                  Everything we stored
                  <IconChevron />
                </summary>
                <dl className="all-dimensions provenance-details">
                  <div>
                    <dt>Feed’s own date</dt>
                    <dd>{dateInfo(data.updatedAt).label}</dd>
                  </div>
                  <div>
                    <dt>Read by defi-dna</dt>
                    <dd>{dateInfo(data.fetchedAt).label}</dd>
                  </div>
                </dl>
                {data.extra ? <blockquote>{JSON.stringify(data.extra, null, 2)}</blockquote> : null}
                <ExternalLink href={feed.methodologyUrl ?? feed.homepage}>
                  {feed.methodologyUrl ? 'Feed methodology' : 'Feed website'}
                </ExternalLink>
              </details>
            </div>
          </details>

          <div className="assessment-card-footer">
            <span className="date-with-help">
              <AssessmentDate value={data.updatedAt} />
              <DataAgeHelp />
            </span>
            <ExternalLink href={data.url ?? feed.homepage}>
              {data.url ? 'View source' : 'Feed website'}
            </ExternalLink>
          </div>
        </>
      ) : (
        <div className="missing-content">
          <h4>
            {data.status === 'error' ? 'We could not read this feed' : 'No data in this feed'}
          </h4>
          <p>
            {data.status === 'error'
              ? 'This is our failure, not a statement about coverage — and certainly not about the protocol.'
              : 'The feed publishes nothing we could map to this protocol. That is a gap in coverage, not a judgement.'}
          </p>
          {data.note ? (
            <details className="original-text">
              <summary>
                {data.status === 'error' ? 'What went wrong' : 'Why this cell is empty'}
                <IconChevron />
              </summary>
              <p>{data.note}</p>
            </details>
          ) : null}
          <ExternalLink href={data.url ?? feed.homepage}>Check the feed</ExternalLink>
        </div>
      )}
    </article>
  )
}
