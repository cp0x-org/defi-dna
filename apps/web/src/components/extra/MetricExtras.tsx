import type { ExtraIncident, ExtraTvlComponent } from '@defi-dna/data'
import { formatUsd } from '../../lib/view.ts'
import { ExternalLink } from '../UI.tsx'

export const TvlComponentsExtra = ({ components }: { components?: ExtraTvlComponent[] }) =>
  Array.isArray(components) && components.length > 0 ? (
    <section className="extra-section">
      <h3>DefiLlama TVL components</h3>
      <div className="extra-table-scroll">
        <table className="extra-table">
          <thead>
            <tr>
              <th>Protocol</th>
              <th>DefiLlama ID</th>
              <th>Ethereum TVL</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.id}>
                <td>{component.name}</td>
                <td className="mono">{component.id}</td>
                <td className="mono">{formatUsd(component.tvl) ?? '—'}</td>
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
    <div className="table-card">
      <div className="matrix-scroll">
        <table className="registry-table">
          <caption className="sr-only">Incident history recorded by DefiLlama</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Event</th>
              <th scope="col">Amount</th>
              <th scope="col">Classification</th>
              <th scope="col">Technique</th>
              <th scope="col">Returned</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {incidents.length > 0 ? (
              incidents.map((incident) => (
                <tr key={`${incident.date}-${incident.name}`}>
                  <td>{incident.date}</td>
                  <td>{incident.name}</td>
                  <td className="mono">{formatUsd(incident.amountUsd) ?? '—'}</td>
                  <td>{incident.classification}</td>
                  <td className="muted">{incident.technique}</td>
                  <td className="mono">{formatUsd(incident.returnedFunds) ?? '—'}</td>
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
                <td colSpan={7} className="muted">
                  {note ?? 'DefiLlama records no incident against this protocol id.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  ) : null
