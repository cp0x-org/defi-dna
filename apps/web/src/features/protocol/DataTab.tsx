import type { Protocol, ProtocolDetail } from '@defi-dna/data'
import {
  GOVERNANCE_METRIC,
  INCIDENTS_METRIC,
  TVL_METRIC,
  feeds,
} from '../../shared/lib/registry.ts'
import { dateInfo, formatUsd, hostOf } from '../../shared/lib/view.ts'
import { Prov } from '../../shared/ui/Coverage.tsx'
import { GovernanceExtra, IncidentsExtra, TvlComponentsExtra } from './extra/MetricExtras.tsx'
import { TextExtra } from './extra/TextExtra.tsx'
import { ExternalLink } from '../../shared/ui/UI.tsx'
import { RegistryFacts } from './RegistryFacts.tsx'

const REGISTRY_URL = 'https://github.com/cp0x-org/defi-dna/blob/main/registry/protocols.json'

/** The protocol's own facts and what DefiLlama measures. No feed opinions here. */
export const DataTab = ({
  protocol,
  record,
  versions,
}: {
  protocol: Protocol
  record: ProtocolDetail
  versions: Protocol[]
}) => {
  const tvl = record.metrics?.[TVL_METRIC]
  const incidents = record.metrics?.[INCIDENTS_METRIC]
  const governance = record.metrics?.[GOVERNANCE_METRIC]
  const feedLinks = feeds.filter(
    (feed) => record.feeds[feed.id]?.status === 'ok' && record.feeds[feed.id]?.url,
  )

  return (
    <>
      <div className="row2">
        <section className="card">
          <div className="card-h">
            <h2>Protocol metadata</h2>
            <Prov kind="meta" />
            <span className="aside">
              registry · <ExternalLink href={REGISTRY_URL}>Suggest an edit</ExternalLink>
            </span>
          </div>
          <div className="card-b">
            {protocol.description ? <p className="desc">{protocol.description}</p> : null}
            <RegistryFacts protocol={protocol} versions={versions} className="facts three" />
          </div>
        </section>
        <section className="card">
          <div className="card-h">
            <h2>TVL</h2>
            <Prov kind="meta" />
            <span className="aside">via DefiLlama · {dateInfo(tvl?.fetchedAt).label}</span>
          </div>
          <div className="card-b">
            <div className="tvl-big">
              {formatUsd(tvl?.value) ?? (record.metrics ? 'Not available' : 'Could not be loaded')}
            </div>
            <p className="tvl-note">
              The Ethereum-mainnet figure, as DefiLlama publishes it. A measured quantity — never
              combined with what a feed says.
            </p>
            <TvlComponentsExtra components={tvl?.extra?.components} />
            <TextExtra text={tvl?.extra?.text} />
          </div>
        </section>
      </div>

      <div className="row2">
        <section className="card span2" id="governance">
          <div className="card-h">
            <h2>Governance</h2>
            <Prov kind="meta" />
            <span className="aside">
              read on-chain · {dateInfo(governance?.updatedAt ?? governance?.fetchedAt).label}
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
                What the governance contracts report could not be loaded. This is our failure, not
                an empty reading.
              </p>
            )}
          </div>
          <div className="card-f">
            <span>
              {governance?.note ??
                'Contracts, the views called on them and their sources are listed in systems.json in the repository. A measured quantity — never combined with what a feed says.'}
              {governance?.note
                ? ' Each fact names the view and the contract it was read from; open the contract on Etherscan (Contract → Read) to repeat it.'
                : ''}
            </span>
            {governance?.url ? <ExternalLink href={governance.url}>Etherscan</ExternalLink> : null}
          </div>
        </section>
      </div>

      <div className="row2">
        <section className="card" id="incidents">
          <div className="card-h">
            <h2>Incidents</h2>
            <Prov kind="src" />
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
                DefiLlama’s incident list could not be loaded. This is our failure, not an empty
                list.
              </p>
            )}
          </div>
          <div className="card-f">
            <span>
              {incidents?.note ??
                'Attributing an incident to a protocol is DefiLlama’s call. defi-dna does not verify, classify or score incidents.'}
            </span>
            {incidents?.url ? (
              <ExternalLink href={incidents.url}>DefiLlama hacks</ExternalLink>
            ) : null}
          </div>
        </section>
        <section className="card">
          <div className="card-h">
            <h2>Links</h2>
            <Prov kind="meta" />
          </div>
          <div className="card-b links-list">
            {protocol.website ? (
              <ExternalLink className="link-row" href={protocol.website}>
                <b>Website</b>
                <span>{hostOf(protocol.website)}</span>
              </ExternalLink>
            ) : null}
            {tvl?.url ? (
              <ExternalLink className="link-row" href={tvl.url}>
                <b>DefiLlama</b>
                <span>{hostOf(tvl.url)}</span>
              </ExternalLink>
            ) : null}
            {feedLinks.map((feed) => (
              <ExternalLink className="link-row" key={feed.id} href={record.feeds[feed.id]?.url}>
                <b>{feed.name}</b>
                <span>{hostOf(record.feeds[feed.id]?.url)}</span>
              </ExternalLink>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
