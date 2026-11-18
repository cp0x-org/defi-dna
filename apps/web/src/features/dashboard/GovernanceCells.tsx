import type { Governance } from './rows.ts'
import { formatDuration } from '../../shared/lib/view.ts'
import type { PopTarget } from './usePopover.ts'

/** Bodies listed in a cell before the rest is left to the protocol page. */
const BODIES_SHOWN = 3

/**
 * The executor timelock as the contract reports it; a dash says why there is
 * none. Whatever was read opens the governance card, so the figure can be
 * checked against the delays and bodies behind it without leaving the table.
 */
export const TimelockCell = ({
  governance,
  absent,
  popTarget,
}: {
  governance: Governance | null
  /** Why nothing is shown when nothing was read: the title of the dash. */
  absent: string
  popTarget?: PopTarget
}) => {
  if (governance == null) {
    return (
      <span className="muted" title={absent}>
        —
      </span>
    )
  }
  const figure =
    governance.delay == null ? (
      <span>
        <span className="muted">—</span>
        <small>no timelock read</small>
      </span>
    ) : (
      <span className="mono" title={`${governance.delay.toLocaleString('en-US')} seconds`}>
        {formatDuration(governance.delay)}
      </span>
    )
  return popTarget ? (
    <button
      type="button"
      className="hit"
      aria-label="What the governance contracts report — show the card"
      {...popTarget}
    >
      {figure}
    </button>
  ) : (
    figure
  )
}

/** Who decides, one body per line: a token vote by its token, a multisig as "threshold of signers", a key as EOA. */
export const GovernanceCell = ({
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
  const shown = governance.bodies.slice(0, BODIES_SHOWN)
  const more = governance.bodies.length - shown.length
  return shown.length === 0 ? (
    <>
      <span className="muted">—</span>
      <small>no deciding body among the contracts read</small>
    </>
  ) : (
    <ul className="bodies">
      {shown.map((body) => (
        <li key={`${body.kind}-${body.address}`}>
          <b className={body.kind === 'multisig' ? 'mono' : undefined}>
            {body.kind === 'multisig'
              ? `${body.threshold} of ${body.signers}`
              : body.kind === 'token-vote'
                ? 'Token vote'
                : body.kind === 'veto'
                  ? 'Veto'
                  : 'EOA'}
          </b>
          <small>{body.token ? `${body.token} · ${body.name}` : body.name}</small>
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
