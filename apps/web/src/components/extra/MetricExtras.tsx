import type { ExtraIncident, ExtraTvlComponent } from '@defi-dna/data'
import { formatUsd } from '../../lib/view.ts'
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
