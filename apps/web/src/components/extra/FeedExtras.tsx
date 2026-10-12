import { useState } from 'react'
import type { Detail, ExtraData, ExtraFinding, ExtraReview, ExtraVault } from '@defi-dna/data'
import { formatUsd } from '../../lib/view.ts'
import { IconChevron } from '../Icons.tsx'
import { Block, ExternalLink } from '../UI.tsx'
import { TextExtra } from './TextExtra.tsx'

/** Rows shown before a long vault list folds. */
const VAULTS_SHOWN = 10

/** True when any shape the page can render is present. Keys it does not know are ignored. */
export const hasFeedExtras = (extra?: ExtraData): boolean =>
  Boolean(extra && Object.values(extra).some((value) => Array.isArray(value) && value.length > 0))

/** Name/value facts about the record, in the feed's own terms. */
const FactsExtra = ({ facts, feedName }: { facts?: Detail[]; feedName: string }) =>
  Array.isArray(facts) && facts.length > 0 ? (
    <Block type="facts" count={facts.length}>
      <h4 className="b-title">As filed by {feedName}</h4>
      <div className="b-metrics">
        {facts.map((fact) => (
          <div className="b-metric" key={fact.name}>
            <span>{fact.name}</span>
            <b>{fact.value}</b>
          </div>
        ))}
      </div>
    </Block>
  ) : null

const ReviewsExtra = ({ reviews, feedName }: { reviews?: ExtraReview[]; feedName: string }) =>
  Array.isArray(reviews) && reviews.length > 0 ? (
    <Block type="reviews" count={reviews.length}>
      <h4 className="b-title">{feedName} reviews</h4>
      <div className="tscroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Review</th>
              <th>Stage</th>
              <th>Risk levels</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.file}>
                <td>
                  <ExternalLink href={review.url}>{review.file}</ExternalLink>
                </td>
                <td>{review.stage}</td>
                <td>{review.risks.length > 0 ? review.risks.join(' · ') : '—'}</td>
                <td className="mono">{review.date ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  ) : null

const FindingsExtra = ({ findings, feedName }: { findings?: ExtraFinding[]; feedName: string }) =>
  Array.isArray(findings) && findings.length > 0 ? (
    <Block type="findings" count={findings.length}>
      <h4 className="b-title">Findings reported by {feedName}</h4>
      <p className="b-note">
        Published by the feed with its own severity; they may span several networks.
      </p>
      <div className="b-finds">
        {findings.map((finding, index) => (
          <details className="b-find" key={`${finding.title}-${index}`}>
            <summary>
              {finding.severity ? <span className="sev">{finding.severity}</span> : null}
              <b>{finding.title}</b>
              {finding.category ? <span className="fstatus">{finding.category}</span> : null}
              <IconChevron />
            </summary>
            <p>{finding.description ?? 'See the original assessment for details.'}</p>
          </details>
        ))}
      </div>
    </Block>
  ) : null

const VaultsExtra = ({ vaults }: { vaults?: ExtraVault[] }) => {
  const [all, setAll] = useState(false)
  if (!Array.isArray(vaults) || vaults.length === 0) return null
  const shown = all ? vaults : vaults.slice(0, VAULTS_SHOWN)
  return (
    <Block type="vaults" count={vaults.length}>
      <h4 className="b-title">Vaults ({vaults.length})</h4>
      <div className="tscroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Vault</th>
              <th>Version</th>
              <th>Curator</th>
              <th>Tier</th>
              <th className="num">Score</th>
              <th className="num">TVL</th>
              <th>Scored</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((vault) => (
              <tr key={vault.url}>
                <td>
                  <ExternalLink href={vault.url}>{vault.name}</ExternalLink>
                </td>
                <td>{vault.version ?? '—'}</td>
                <td>{vault.curator ?? '—'}</td>
                <td>{vault.tier ?? '—'}</td>
                <td className="num mono">{vault.score ?? '—'}</td>
                <td className="num mono">{formatUsd(vault.tvlUsd) ?? '—'}</td>
                <td className="mono">{vault.scoredAt ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vaults.length > VAULTS_SHOWN ? (
        <button className="text-btn b-more" type="button" onClick={() => setAll(!all)}>
          {all ? `Show the first ${VAULTS_SHOWN}` : `Show all ${vaults.length} vaults`}
        </button>
      ) : null}
    </Block>
  )
}

/** One block per shape; each renders only when its field is present. */
export const FeedExtras = ({ extra, feedName }: { extra?: ExtraData; feedName: string }) =>
  hasFeedExtras(extra) ? (
    <>
      <FactsExtra facts={extra?.facts} feedName={feedName} />
      <ReviewsExtra reviews={extra?.reviews} feedName={feedName} />
      <FindingsExtra findings={extra?.findings} feedName={feedName} />
      <VaultsExtra vaults={extra?.vaults} />
      {extra?.text?.length ? (
        <Block type="text">
          <TextExtra text={extra.text} />
        </Block>
      ) : null}
    </>
  ) : null
