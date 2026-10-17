import type { Protocol } from '@defi-dna/data'
import { categoryLabel, hostOf } from '../../lib/view.ts'
import { ExternalLink } from '../../components/UI.tsx'

/** The hand-maintained facts, the same list on the overview and the data tab. */
export const RegistryFacts = ({
  protocol,
  versions,
  className = 'facts',
}: {
  protocol: Protocol
  versions: Protocol[]
  className?: string
}) => (
  <dl className={className}>
    <div>
      <dt>Name</dt>
      <dd>{protocol.name}</dd>
    </div>
    <div>
      <dt>Protocol</dt>
      <dd>{protocol.group ?? protocol.name}</dd>
    </div>
    <div>
      <dt>Category</dt>
      <dd>{categoryLabel(protocol.category)}</dd>
    </div>
    <div>
      <dt>Network</dt>
      <dd>Ethereum mainnet</dd>
    </div>
    <div>
      <dt>Versions tracked</dt>
      <dd>{versions.length}</dd>
    </div>
    <div>
      <dt>Registry id</dt>
      <dd className="mono">{protocol.id}</dd>
    </div>
    {protocol.website ? (
      <div>
        <dt>Website</dt>
        <dd>
          <ExternalLink href={protocol.website}>{hostOf(protocol.website)}</ExternalLink>
        </dd>
      </div>
    ) : null}
  </dl>
)
