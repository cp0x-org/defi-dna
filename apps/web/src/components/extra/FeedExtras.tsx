import type { Detail, ExtraData, ExtraFinding, ExtraReview, ExtraVault } from '@defi-dna/data'
import { formatUsd } from '../../lib/view.ts'
import { IconChevron } from '../Icons.tsx'
import { ExternalLink } from '../UI.tsx'
import { TextExtra } from './TextExtra.tsx'

/** True when any shape the page can render is present. Keys it does not know are ignored. */
export const hasFeedExtras = (extra?: ExtraData): boolean =>
  Boolean(extra && Object.values(extra).some((value) => Array.isArray(value) && value.length > 0))

/** Name/value facts about the record, in the feed's own terms. */
const FactsExtra = ({ facts, feedName }: { facts?: Detail[]; feedName: string }) =>
  Array.isArray(facts) && facts.length > 0 ? (
    <section className="extra-section">
      <h4>As filed by {feedName}</h4>
      <dl className="extra-facts">
        {facts.map((fact) => (
          <div key={fact.name}>
            <dt>{fact.name}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  ) : null

const ReviewsExtra = ({ reviews, feedName }: { reviews?: ExtraReview[]; feedName: string }) =>
  Array.isArray(reviews) && reviews.length > 0 ? (
    <section className="extra-section">
      <h4>{feedName} reviews</h4>
      <ul className="extra-list">
        {reviews.map((review) => (
          <li key={review.file}>
            <ExternalLink href={review.url}>{review.file}</ExternalLink>
            <span>{review.stage}</span>
            {review.date ? <span>{review.date}</span> : null}
            {review.risks.length > 0 ? (
              <small>Risk levels: {review.risks.join(' · ')}</small>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  ) : null

const FindingsExtra = ({ findings, feedName }: { findings?: ExtraFinding[]; feedName: string }) =>
  Array.isArray(findings) && findings.length > 0 ? (
    <section className="extra-section">
      <h4>Findings reported by {feedName}</h4>
      <p className="small muted">Published by the feed; they may span several networks.</p>
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
            {finding.category ? <small className="muted">{finding.category}</small> : null}
            <p>{finding.description ?? 'See the original assessment for details.'}</p>
          </details>
        ))}
      </div>
    </section>
  ) : null

const VaultsExtra = ({ vaults }: { vaults?: ExtraVault[] }) =>
  Array.isArray(vaults) && vaults.length > 0 ? (
    <details className="extra-section extra-group">
      <summary>
        Vaults ({vaults.length}) <IconChevron />
      </summary>
      <div className="extra-table-scroll">
        <table className="extra-table">
          <thead>
            <tr>
              <th>Vault</th>
              <th>Version</th>
              <th>Curator</th>
              <th>Tier</th>
              <th>Score</th>
              <th>TVL</th>
              <th>Scored</th>
            </tr>
          </thead>
          <tbody>
            {vaults.map((vault) => (
              <tr key={vault.url}>
                <td>
                  <ExternalLink href={vault.url}>{vault.name}</ExternalLink>
                </td>
                <td>{vault.version ?? '—'}</td>
                <td>{vault.curator ?? '—'}</td>
                <td>{vault.tier ?? '—'}</td>
                <td>{vault.score ?? '—'}</td>
                <td>{formatUsd(vault.tvlUsd) ?? '—'}</td>
                <td>{vault.scoredAt ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  ) : null

/** One component per shape; each renders only when its field is present. */
export const FeedExtras = ({ extra, feedName }: { extra?: ExtraData; feedName: string }) =>
  hasFeedExtras(extra) ? (
    <>
      <FactsExtra facts={extra?.facts} feedName={feedName} />
      <ReviewsExtra reviews={extra?.reviews} feedName={feedName} />
      <FindingsExtra findings={extra?.findings} feedName={feedName} />
      <VaultsExtra vaults={extra?.vaults} />
      <TextExtra text={extra?.text} />
    </>
  ) : null
