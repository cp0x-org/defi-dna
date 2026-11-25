import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import type { ProtocolDetail } from '@defi-dna/data'
import { GOVERNANCE_METRIC, INCIDENTS_METRIC } from '../../shared/lib/registry.ts'
import { dateInfo } from '../../shared/lib/view.ts'
import { GovernanceExtra, IncidentsExtra } from './extra/MetricExtras.tsx'
import { TextExtra } from './extra/TextExtra.tsx'
import { ExternalLink } from '../../shared/ui/UI.tsx'

const LINK = /(https?:\/\/[^\s)]+)/

/** A note with its URLs clickable, for a metric that names where to look (a Snapshot space). */
const Linked = ({ text }: { text: string }) => (
  <>
    {text.split(LINK).map((part, k) =>
      LINK.test(part) ? (
        <ExternalLink key={k} href={part}>
          {part.replace(/^https?:\/\//, '')}
        </ExternalLink>
      ) : (
        part
      ),
    )}
  </>
)

/**
 * Who decides and how fast, as the protocol's governance contracts report it
 * on-chain, then what DefiLlama measures. Facts about the protocol; no feed
 * opinions here.
 */
export const GovernanceTab = ({ record }: { record: ProtocolDetail }) => {
  const incidents = record.metrics?.[INCIDENTS_METRIC]
  const governance = record.metrics?.[GOVERNANCE_METRIC]
  const location = useLocation()
  const incidentsRef = useRef<HTMLElement>(null)

  // "Open incidents" lands on #incidents. The record loads after the layout has
  // already looked for the anchor, so the scroll happens here, once the block
  // exists. The mark follows on the next frame, holds, then fades.
  useEffect(() => {
    const node = incidentsRef.current
    if (!node || location.hash !== '#incidents') return
    node.scrollIntoView({ block: 'start' })
    node.focus({ preventScroll: true })
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let removeTimer = 0
    const frame = window.requestAnimationFrame(() => {
      node.classList.remove('anchor-flash')
      void node.offsetWidth
      node.classList.add('anchor-flash')
      removeTimer = window.setTimeout(() => node.classList.remove('anchor-flash'), 700)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(removeTimer)
      node.classList.remove('anchor-flash')
    }
  }, [location.hash])

  return (
    <div className="stack gov">
      <section className="card" id="governance">
        <div className="card-h">
          <h2>Governance</h2>
          <span className="aside">
            read on-chain · data cut{' '}
            {dateInfo(governance?.updatedAt ?? governance?.fetchedAt).label}
          </span>
        </div>
        <div className="card-b">
          {governance?.extra?.facts?.length ? (
            <GovernanceExtra value={governance.value} facts={governance.extra.facts} />
          ) : record.metrics ? (
            <p className="muted">
              No governance contracts are mapped for this version; nothing was read.
            </p>
          ) : (
            <p className="muted">
              What the governance contracts report could not be loaded. This is our failure, not an
              empty reading.
            </p>
          )}
        </div>
        <div className="card-f">
          <span>
            {governance?.note ? (
              <Linked text={governance.note} />
            ) : (
              'Contracts, the views called on them and their sources are listed in systems.json in the repository. A measured quantity — never combined with what a feed says.'
            )}
            {governance?.note
              ? ' Each fact names the view and the contract it was read from; open the contract on Etherscan (Contract → Read) to repeat it.'
              : ''}
          </span>
          {governance?.url ? <ExternalLink href={governance.url}>Etherscan</ExternalLink> : null}
        </div>
      </section>

      <section className="card" id="incidents" ref={incidentsRef} tabIndex={-1}>
        <div className="card-h">
          <h2>Incidents</h2>
          <span className="aside">recorded by DefiLlama</span>
        </div>
        <div className="card-b">
          {incidents ? (
            <>
              <IncidentsExtra incidents={incidents.extra?.incidents ?? []} />
              <TextExtra text={incidents.extra?.text} />
            </>
          ) : record.metrics ? (
            <p className="muted">DefiLlama’s incident list was not collected for this version.</p>
          ) : (
            <p className="muted">
              DefiLlama’s incident list could not be loaded. This is our failure, not an empty list.
            </p>
          )}
        </div>
        <div className="card-f">
          <span>
            {incidents?.note ??
              'Attributing an incident to a protocol is DefiLlama’s call. defidna does not verify, classify or score incidents.'}
          </span>
          {incidents?.url ? (
            <ExternalLink href={incidents.url}>DefiLlama hacks</ExternalLink>
          ) : null}
        </div>
      </section>
    </div>
  )
}
