import type { Governance } from './rows.ts'
import { formatDuration } from '../../shared/lib/view.ts'

/** Multisigs listed in a cell before the rest is left to the protocol page. */
const MULTISIGS_SHOWN = 3

/** The executor timelock as the contract reports it; a dash says why there is none. */
export const TimelockCell = ({
  governance,
  absent,
}: {
  governance: Governance | null
  /** Why nothing is shown when nothing was read: the title of the dash. */
  absent: string
}) =>
  governance == null ? (
    <span className="muted" title={absent}>
      —
    </span>
  ) : governance.delay == null ? (
    <>
      <span className="muted">—</span>
      <small>no timelock read</small>
    </>
  ) : (
    <>
      <span className="mono">{formatDuration(governance.delay)}</span>
      <small>{governance.delay.toLocaleString('en-US')} s</small>
    </>
  )

/** Each multisig read, as "threshold of signers"; the names say which contract. */
export const MultisigCell = ({
  governance,
  absent,
}: {
  governance: Governance | null
  absent: string
}) => {
  if (governance == null) {
    return (
      <span className="muted" title={absent}>
        —
      </span>
    )
  }
  const shown = governance.multisigs.slice(0, MULTISIGS_SHOWN)
  const more = governance.multisigs.length - shown.length
  return shown.length === 0 ? (
    <>
      <span className="muted">—</span>
      <small>no multisig read</small>
    </>
  ) : (
    <ul className="msigs">
      {shown.map((multisig) => (
        <li key={multisig.address}>
          <b className="mono">
            {multisig.threshold} of {multisig.signers}
          </b>
          <small>{multisig.name}</small>
        </li>
      ))}
      {more > 0 ? (
        <li>
          <small>+{more} more on the protocol page</small>
        </li>
      ) : null}
    </ul>
  )
}
