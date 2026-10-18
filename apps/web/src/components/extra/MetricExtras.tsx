import type { Detail, ExtraIncident, ExtraTvlComponent } from '@defi-dna/data'
import { formatDuration, formatUsd } from '../../lib/view.ts'
import { ExternalLink } from '../UI.tsx'

export const TvlComponentsExtra = ({ components }: { components?: ExtraTvlComponent[] }) =>
  Array.isArray(components) && components.length > 0 ? (
    <section className="tvl-components">
      <h4 className="b-title">DefiLlama TVL components</h4>
      <div className="tscroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Protocol</th>
              <th>DefiLlama ID</th>
              <th className="num">Ethereum TVL</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.id}>
                <td>{component.name}</td>
                <td className="mono">{component.id}</td>
                <td className="num mono">{formatUsd(component.tvl) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  ) : null

export const IncidentsExtra = ({
  incidents,
  note,
}: {
  incidents?: ExtraIncident[]
  note?: string
}) =>
  Array.isArray(incidents) ? (
    <div className="tscroll">
      <table className="tbl">
        <caption className="sr-only">Incident history recorded by DefiLlama</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Event</th>
            <th scope="col" className="num">
              Amount
            </th>
            <th scope="col">Classification</th>
            <th scope="col">Technique</th>
            <th scope="col" className="num">
              Returned
            </th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {incidents.length > 0 ? (
            incidents.map((incident) => (
              <tr key={`${incident.date}-${incident.name}`}>
                <td className="mono">{incident.date}</td>
                <td>{incident.name}</td>
                <td className="num mono">{formatUsd(incident.amountUsd) ?? '—'}</td>
                <td>{incident.classification}</td>
                <td className="muted">{incident.technique}</td>
                <td className="num mono">{formatUsd(incident.returnedFunds) ?? '—'}</td>
                <td>
                  {incident.source ? (
                    <ExternalLink href={incident.source}>Report</ExternalLink>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="muted wrap">
                {note ?? 'DefiLlama records no incident against this protocol id.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  ) : null

const ETHERSCAN = 'https://etherscan.io/address/'
const ADDRESS = /(0x[0-9a-fA-F]{40})/

/** The read behind a fact — "delay() on Timelock 0x6d90…" — with the contract linked to Etherscan's read tab. */
const Where = ({ text }: { text: string }) => (
  <small className="where">
    {text.split(ADDRESS).map((part, k) =>
      ADDRESS.test(part) ? (
        <ExternalLink key={k} href={`${ETHERSCAN}${part}#readContract`}>
          {part}
        </ExternalLink>
      ) : (
        part
      ),
    )}
  </small>
)

/**
 * The governance metric: the timelock delay as the headline and the facts read
 * next to it — role holders, signer thresholds, voting parameters — each as the
 * contract returned it, with the view and the contract it was read from so a
 * reader can repeat the call.
 */
export const GovernanceExtra = ({ value, facts }: { value: number | null; facts?: Detail[] }) => (
  <>
    <div className="tvl-big">{formatDuration(value) ?? '—'}</div>
    <p className="tvl-note">
      {value == null
        ? 'None of the contracts read for this version is a timelock.'
        : `${value.toLocaleString('en-US')} seconds between scheduling and execution, as the timelock contract reports it.`}
    </p>
    {Array.isArray(facts) && facts.length > 0 ? (
      <dl className="facts one governance-facts">
        {facts.map((fact) => (
          <div key={fact.name}>
            <dt>{fact.name}</dt>
            <dd className="mono">
              {fact.value}
              {fact.description ? <Where text={fact.description} /> : null}
            </dd>
          </div>
        ))}
      </dl>
    ) : null}
  </>
)
