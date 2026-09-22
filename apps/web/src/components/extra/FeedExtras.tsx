import type { ExtraData, ExtraFinding, ExtraReview, ExtraVault } from '@defi-dna/data'
import { formatUsd } from '../../lib/view.ts'
import { IconChevron } from '../Icons.tsx'
import { ExternalLink } from '../UI.tsx'
import { TextExtra } from './TextExtra.tsx'

export const hasFeedExtras = (extra?: ExtraData): boolean =>
  Boolean(
    extra &&
    ((Array.isArray(extra.reviews) && extra.reviews.length > 0) ||
      (Array.isArray(extra.keyFindings) && extra.keyFindings.length > 0) ||
      (Array.isArray(extra.vaults) && extra.vaults.length > 0) ||
      (Array.isArray(extra.text) && extra.text.length > 0) ||
      [
        'domain',
        'riskLevel',
        'overallScore',
        'analysisStatus',
        'philidorId',
        'versions',
        'vaultsListed',
        'vaultsLive',
        'vaultsShutdown',
        'vaultsRated',
      ].some((key) => key in extra)),
  )

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

const RiskAnalysisExtra = ({ extra }: { extra?: ExtraData }) => {
  if (
    !extra ||
    !['domain', 'riskLevel', 'overallScore', 'analysisStatus'].some((key) => key in extra)
  )
    return null
  return (
    <section className="extra-section">
      <h4>Analysis context</h4>
      <dl className="extra-facts">
        {'domain' in extra ? (
          <div>
            <dt>Analyzed domain</dt>
            <dd>{extra.domain ?? '—'}</dd>
          </div>
        ) : null}
        {'riskLevel' in extra ? (
          <div>
            <dt>Risk level</dt>
            <dd>{extra.riskLevel ?? '—'}</dd>
          </div>
        ) : null}
        {'overallScore' in extra ? (
          <div>
            <dt>Overall score</dt>
            <dd>{extra.overallScore ?? '—'}</dd>
          </div>
        ) : null}
        {'analysisStatus' in extra ? (
          <div>
            <dt>Analysis status</dt>
            <dd>{extra.analysisStatus ?? '—'}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

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

const VaultOverviewExtra = ({ extra }: { extra?: ExtraData }) => {
  if (
    !extra ||
    !['philidorId', 'versions', 'vaultsListed', 'vaultsLive', 'vaultsShutdown', 'vaultsRated'].some(
      (key) => key in extra,
    )
  )
    return null
  return (
    <section className="extra-section">
      <h4>Vault coverage</h4>
      <dl className="extra-facts">
        {'philidorId' in extra ? (
          <div>
            <dt>Philidor protocol</dt>
            <dd>{extra.philidorId ?? '—'}</dd>
          </div>
        ) : null}
        {'versions' in extra ? (
          <div>
            <dt>Versions</dt>
            <dd>{extra.versions?.join(', ') || 'All'}</dd>
          </div>
        ) : null}
        {'vaultsListed' in extra ? (
          <div>
            <dt>Listed</dt>
            <dd>{extra.vaultsListed ?? '—'}</dd>
          </div>
        ) : null}
        {'vaultsLive' in extra ? (
          <div>
            <dt>Live</dt>
            <dd>{extra.vaultsLive ?? '—'}</dd>
          </div>
        ) : null}
        {'vaultsShutdown' in extra ? (
          <div>
            <dt>Shut down</dt>
            <dd>{extra.vaultsShutdown ?? '—'}</dd>
          </div>
        ) : null}
        {'vaultsRated' in extra ? (
          <div>
            <dt>Rated</dt>
            <dd>{extra.vaultsRated ?? '—'}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

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

export const FeedExtras = ({ extra, feedName }: { extra?: ExtraData; feedName: string }) =>
  hasFeedExtras(extra) ? (
    <>
      <ReviewsExtra reviews={extra?.reviews} feedName={feedName} />
      <RiskAnalysisExtra extra={extra} />
      <FindingsExtra findings={extra?.keyFindings} feedName={feedName} />
      <VaultOverviewExtra extra={extra} />
      <VaultsExtra vaults={extra?.vaults} />
      <TextExtra text={extra?.text} />
    </>
  ) : null
