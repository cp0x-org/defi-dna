import {
  formatDuration,
  type AdapterContext,
  type Detail,
  type MetricAdapter,
} from '@defi-dna/core'
import systemsFile from './systems.json' with { type: 'json' }

/**
 * Used when ETH_RPC_URL is not set. A keyed endpoint (Ankr, Alchemy, …) goes
 * into the variable; the key sits in the URL, so that URL is never logged.
 */
const PUBLIC_RPC = 'https://ethereum-rpc.publicnode.com'
/** Governance parameters move by proposal, not by the minute; a run is twice a day. */
const TTL = 1800
const ETHERSCAN = 'https://etherscan.io/address/'

/**
 * Function selectors, the first four bytes of keccak256 of the signature
 * (`cast sig`). Kept as constants: the pipeline has no keccak and no ABI
 * library, and these do not change.
 */
const SELECTOR = {
  'delay()': '0x6a42b8f8',
  'admin()': '0xf851a440',
  'getMinDelay()': '0xf27a0c92',
  'getExecutorSettingsByAccessControl(uint8)': '0xf80281fb',
  'getAfterSubmitDelay()': '0x709105d7',
  'getAfterScheduleDelay()': '0x5d5f5564',
  'isEmergencyModeActive()': '0xe88c997e',
  'getEffectiveState()': '0xdba9b4d5',
  'votingDelay()': '0x3932abb1',
  'votingPeriod()': '0x02a251a3',
  'proposalThreshold()': '0xb58131b0',
  'quorumVotes()': '0x24bc1a64',
  'quorum(uint256)': '0xf8ce560a',
  'CLOCK_MODE()': '0x4bf5d7e9',
  'voteTime()': '0xbcf93dd6',
  'supportRequiredPct()': '0xfad167ab',
  'minAcceptQuorumPct()': '0xdc474b1a',
  'getThreshold()': '0xe75235b8',
  'getOwners()': '0xa0e67e2b',
  'owner()': '0x8da5cb5b',
  'manager()': '0x481c6a75',
  'getGuardian()': '0xa75b87d2',
  'getAddress(bytes32)': '0x21f8a721',
  'getMemberCount()': '0x997072f7',
} as const
type Signature = keyof typeof SELECTOR

/** `keccak256(abi.encodePacked("contract.address", "rocketDAOSecurity"))`, the RocketStorage key. */
const ROCKET_DAO_SECURITY_KEY = '0x72244aef95b32bf9d0fd65a6e3212550a59abd181a93cfc66753a7197c36df07'
/** Lido Dual Governance `State`, in the contract's enum order. */
const DUAL_GOVERNANCE_STATES = [
  'Unset',
  'Normal',
  'VetoSignalling',
  'VetoSignallingDeactivation',
  'VetoCooldown',
  'RageQuit',
]

type Kind =
  | 'timelock'
  | 'oz-timelock'
  | 'aave-payloads-controller'
  | 'lido-timelock'
  | 'lido-dual-governance'
  | 'governor'
  | 'aragon-voting'
  | 'safe'
  | 'holder'
  | 'rocket-dao-security'

interface Contract {
  label: string
  address: string
  kind: Kind
  /** `holder` only: the view that returns the privileged address. */
  method?: 'owner()' | 'manager()' | 'getGuardian()'
  /** `governor` only: the unit of thresholds and quorums. */
  token?: string
}

interface System {
  name: string
  source: string
  contracts: Contract[]
}

const SYSTEMS = Object.fromEntries(
  Object.entries(systemsFile).filter(([key]) => !key.startsWith('_')),
) as Record<string, System>

/* ------------------------------------------------------------------ JSON-RPC */

interface RpcAnswer {
  id: number
  result?: unknown
  error?: { code: number; message: string }
}

interface Rpc {
  /** `eth_call`; null when the contract reverted or returned nothing (no such method, or an EOA). */
  call(to: string, data: string): Promise<string | null>
  /** `eth_getCode`; `0x` for an externally owned account. */
  code(address: string): Promise<string>
  request<T>(method: string, params: unknown[]): Promise<T>
}

/**
 * JSON-RPC over the adapter context, batched: every request made in one tick
 * goes out as one POST. The probes of a system run concurrently, so a system
 * costs two or three round trips instead of one per view. The body is
 * deterministic, so the HTTP cache replays a run offline.
 */
function createRpc(ctx: AdapterContext, url: string): Rpc {
  interface Pending {
    method: string
    params: unknown[]
    resolve: (value: unknown) => void
    reject: (reason: unknown) => void
  }
  let queue: Pending[] = []
  let scheduled = false

  const flush = async () => {
    const batch = queue
    queue = []
    scheduled = false
    const body = batch.map(({ method, params }, index) => ({
      jsonrpc: '2.0',
      id: index + 1,
      method,
      params,
    }))
    try {
      const answers = await ctx.postJson<RpcAnswer[]>(url, body, { ttlSeconds: TTL })
      if (!Array.isArray(answers)) throw new Error('JSON-RPC batch did not return a list')
      const byId = new Map(answers.map((answer) => [answer.id, answer]))
      batch.forEach((pending, index) => {
        const answer = byId.get(index + 1)
        if (!answer) {
          pending.reject(new Error(`no answer for ${pending.method}`))
        } else if (answer.error) {
          // A revert is an answer: the contract has no such view. Anything
          // else — a rate limit, a malformed request — is a failure to read.
          if (answer.error.code === 3 || /revert/i.test(answer.error.message)) pending.resolve(null)
          else pending.reject(new Error(`${pending.method}: ${answer.error.message}`))
        } else {
          pending.resolve(answer.result)
        }
      })
    } catch (error) {
      batch.forEach((pending) => pending.reject(error))
    }
  }

  const request = <T>(method: string, params: unknown[]) =>
    new Promise<T>((resolve, reject) => {
      queue.push({ method, params, resolve: resolve as (value: unknown) => void, reject })
      if (!scheduled) {
        scheduled = true
        setTimeout(flush, 0)
      }
    })

  return {
    request,
    async call(to, data) {
      const result = await request<string | null>('eth_call', [{ to, data }, 'latest'])
      return typeof result === 'string' && result.length > 2 ? result : null
    },
    code: (address) => request<string>('eth_getCode', [address, 'latest']),
  }
}

/* --------------------------------------------------------------- ABI decoding */

const WORD = 64

const word = (hex: string, index = 0): bigint =>
  BigInt(`0x${hex.slice(2 + index * WORD, 2 + (index + 1) * WORD) || '0'}`)

const addressAt = (hex: string, index = 0): string =>
  `0x${hex.slice(2 + index * WORD + 24, 2 + (index + 1) * WORD)}`

/** A dynamic `address[]`: offset, length, then one word per item. */
function addressList(hex: string): string[] {
  const offset = Number(word(hex, 0)) / 32
  const length = Number(word(hex, offset))
  return Array.from({ length }, (_, i) => addressAt(hex, offset + 1 + i))
}

/** A dynamic `string`: offset, length, then the UTF-8 bytes. */
function text(hex: string): string {
  const offset = Number(word(hex, 0)) / 32
  const length = Number(word(hex, offset))
  const bytes = hex.slice(2 + (offset + 1) * WORD, 2 + (offset + 1) * WORD + length * 2)
  return Buffer.from(bytes, 'hex').toString('utf8')
}

const encodeUint = (value: number | bigint): string => value.toString(16).padStart(WORD, '0')

/* -------------------------------------------------------------------- probes */

interface Probed {
  facts: Detail[]
  /** The delay this contract enforces before execution, in seconds, when it is a timelock. */
  delay?: number
}

/** `172800 s (2 days)`: the chain's unit first, the readable one after it. */
const seconds = (value: bigint): string => {
  const raw = Number(value)
  const readable = formatDuration(raw)
  return readable && readable !== `${raw} s` ? `${raw} s (${readable})` : `${raw} s`
}

/** An 18-decimal token amount as whole tokens; governance tokens here all have 18 decimals. */
const tokens = (value: bigint, symbol: string): string =>
  `${(value / 10n ** 18n).toLocaleString('en-US')} ${symbol}`

/** Aragon's `PCT_BASE` is 1e18: `510000000000000000` is 51 %. */
const percent = (value: bigint): string => `${Number(value / 10n ** 14n) / 100}%`

const short = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`

/** A required view: a revert here means the address is not what systems.json says. */
async function must(
  rpc: Rpc,
  contract: Contract,
  signature: Signature,
  args = '',
): Promise<string> {
  const result = await rpc.call(contract.address, SELECTOR[signature] + args)
  if (result === null)
    throw new Error(`${contract.label} (${contract.address}): ${signature} reverted`)
  return result
}

/**
 * What kind of account holds a privileged role: an externally owned account,
 * a Safe (with its threshold), or some other contract. Facts a reader checks
 * on the explorer, not a judgement.
 */
async function describe(rpc: Rpc, address: string): Promise<string> {
  const [code, threshold, owners] = await Promise.all([
    rpc.code(address),
    rpc.call(address, SELECTOR['getThreshold()']),
    rpc.call(address, SELECTOR['getOwners()']),
  ])
  if (code === '0x') return `${address} (EOA)`
  if (threshold && owners) {
    return `${address} (Safe, ${word(threshold)} of ${addressList(owners).length} signers)`
  }
  return `${address} (contract)`
}

const PROBES: Record<Kind, (rpc: Rpc, contract: Contract, block: number) => Promise<Probed>> = {
  async timelock(rpc, contract) {
    const [delay, admin] = await Promise.all([
      must(rpc, contract, 'delay()'),
      rpc.call(contract.address, SELECTOR['admin()']),
    ])
    const facts: Detail[] = [{ name: `${contract.label} delay`, value: seconds(word(delay)) }]
    if (admin) {
      facts.push({
        name: `${contract.label} admin`,
        value: await describe(rpc, addressAt(admin)),
      })
    }
    return { facts, delay: Number(word(delay)) }
  },

  async 'oz-timelock'(rpc, contract) {
    const delay = word(await must(rpc, contract, 'getMinDelay()'))
    return {
      facts: [{ name: `${contract.label} minimum delay`, value: seconds(delay) }],
      delay: Number(delay),
    }
  },

  /** Aave Governance V3: one executor per access level, each with its own delay. */
  async 'aave-payloads-controller'(rpc, contract) {
    const levels = await Promise.all(
      [1, 2].map((level) =>
        must(rpc, contract, 'getExecutorSettingsByAccessControl(uint8)', encodeUint(level)),
      ),
    )
    const facts = levels.flatMap((settings, index) => [
      { name: `Executor level ${index + 1} delay`, value: seconds(word(settings, 1)) },
      { name: `Executor level ${index + 1}`, value: addressAt(settings, 0) },
    ])
    return { facts, delay: Number(word(levels[0] as string, 1)) }
  },

  /** Lido's Emergency Protected Timelock: a delay after submission and another after scheduling. */
  async 'lido-timelock'(rpc, contract) {
    const [submit, schedule, emergency] = await Promise.all([
      must(rpc, contract, 'getAfterSubmitDelay()'),
      must(rpc, contract, 'getAfterScheduleDelay()'),
      must(rpc, contract, 'isEmergencyModeActive()'),
    ])
    return {
      facts: [
        { name: 'After-submit delay', value: seconds(word(submit)) },
        { name: 'After-schedule delay', value: seconds(word(schedule)) },
        { name: 'Emergency mode', value: word(emergency) === 0n ? 'not active' : 'active' },
      ],
      delay: Number(word(submit) + word(schedule)),
    }
  },

  async 'lido-dual-governance'(rpc, contract) {
    const state = Number(word(await must(rpc, contract, 'getEffectiveState()')))
    return {
      facts: [
        { name: 'Dual Governance state', value: DUAL_GOVERNANCE_STATES[state] ?? `state ${state}` },
      ],
    }
  },

  /** GovernorBravo and OZ Governor share these views; the clock decides the unit. */
  async governor(rpc, contract, block) {
    const symbol = contract.token ?? 'votes'
    const [delay, period, threshold, bravoQuorum, ozQuorum, clock] = await Promise.all([
      must(rpc, contract, 'votingDelay()'),
      must(rpc, contract, 'votingPeriod()'),
      must(rpc, contract, 'proposalThreshold()'),
      rpc.call(contract.address, SELECTOR['quorumVotes()']),
      rpc.call(contract.address, SELECTOR['quorum(uint256)'] + encodeUint(block - 1)),
      rpc.call(contract.address, SELECTOR['CLOCK_MODE()']),
    ])
    const unit = clock && text(clock).includes('timestamp') ? 's' : 'blocks'
    const quorum = bravoQuorum ?? ozQuorum
    return {
      facts: [
        { name: `${contract.label} voting delay`, value: `${word(delay)} ${unit}` },
        { name: `${contract.label} voting period`, value: `${word(period)} ${unit}` },
        { name: `${contract.label} proposal threshold`, value: tokens(word(threshold), symbol) },
        ...(quorum
          ? [{ name: `${contract.label} quorum`, value: tokens(word(quorum), symbol) }]
          : []),
      ],
    }
  },

  async 'aragon-voting'(rpc, contract) {
    const [time, support, quorum] = await Promise.all([
      must(rpc, contract, 'voteTime()'),
      must(rpc, contract, 'supportRequiredPct()'),
      must(rpc, contract, 'minAcceptQuorumPct()'),
    ])
    return {
      facts: [
        { name: `${contract.label} duration`, value: seconds(word(time)) },
        { name: `${contract.label} support required`, value: percent(word(support)) },
        { name: `${contract.label} minimum quorum`, value: percent(word(quorum)) },
      ],
    }
  },

  async safe(rpc, contract) {
    const [threshold, owners] = await Promise.all([
      must(rpc, contract, 'getThreshold()'),
      must(rpc, contract, 'getOwners()'),
    ])
    return {
      facts: [
        {
          name: contract.label,
          value: `${word(threshold)} of ${addressList(owners).length} signers`,
        },
      ],
    }
  },

  async holder(rpc, contract) {
    const method = contract.method ?? 'owner()'
    const holder = addressAt(await must(rpc, contract, method))
    return { facts: [{ name: contract.label, value: await describe(rpc, holder) }] }
  },

  /** RocketStorage names the current security DAO contract; its member count is read from there. */
  async 'rocket-dao-security'(rpc, contract) {
    const dao = addressAt(
      await must(rpc, contract, 'getAddress(bytes32)', ROCKET_DAO_SECURITY_KEY.slice(2)),
    )
    const count = await rpc.call(dao, SELECTOR['getMemberCount()'])
    if (count === null) throw new Error(`${contract.label}: getMemberCount() reverted at ${dao}`)
    return {
      facts: [{ name: `${contract.label} members`, value: `${word(count)} (${short(dao)})` }],
    }
  },
}

/* ------------------------------------------------------------------- adapter */

interface Reading {
  system: System
  /** Seconds the first timelock in the list enforces; null when no contract read is one. */
  delay: number | null
  /** The contract whose delay is the headline. */
  timelock: Contract | null
  facts: Detail[]
}

export interface Prepared {
  block: number
  /** The block's own timestamp: the chain's date for every value read. */
  observedAt: string
  systems: Map<string, Reading | Error>
}

/**
 * Governance parameters read from Ethereum mainnet: the delay a timelock
 * enforces before a governance decision executes, and the facts around it —
 * who holds the admin roles, how many signers a guardian multisig needs,
 * voting periods and quorums as the governor contract states them.
 *
 * Every number is what the contract returns at the block named in `note`; the
 * contracts come from systems.json, where each has the protocol's own address
 * registry as source. Reading them is a measurement, not a verdict: a short
 * delay or an EOA in a role is reported, never scored.
 */
const adapter: MetricAdapter<Prepared> = {
  id: 'governance',

  async prepare(ctx): Promise<Prepared> {
    const url = process.env['ETH_RPC_URL'] || PUBLIC_RPC
    ctx.log(`reading Ethereum mainnet via ${new URL(url).host}`)
    const rpc = createRpc(ctx, url)
    const head = await rpc.request<{ number: string; timestamp: string }>('eth_getBlockByNumber', [
      'latest',
      false,
    ])
    const block = Number(head.number)
    const observedAt = new Date(Number(head.timestamp) * 1000).toISOString()

    const systems = new Map<string, Reading | Error>()
    for (const [protocolId, ids] of Object.entries(ctx.mapping)) {
      if (ids.length !== 1) throw new Error(`mapping.json: "${protocolId}" must name one system`)
    }
    // One system at a time: its probes run together and their views go out
    // in one or two batched requests, so the endpoint sees a steady trickle.
    for (const id of new Set(Object.values(ctx.mapping).flat())) {
      const system = SYSTEMS[id]
      if (!system) throw new Error(`systems.json has no entry "${id}"`)
      try {
        const probed = await Promise.all(
          system.contracts.map((contract) => PROBES[contract.kind](rpc, contract, block)),
        )
        const index = probed.findIndex((result) => result.delay != null)
        systems.set(id, {
          system,
          delay: index >= 0 ? (probed[index]?.delay ?? null) : null,
          timelock: index >= 0 ? (system.contracts[index] ?? null) : null,
          facts: probed.flatMap((result) => result.facts),
        })
      } catch (error) {
        systems.set(id, error instanceof Error ? error : new Error(String(error)))
      }
    }
    ctx.log(`${systems.size} governance systems read at block ${block}`)
    return { block, observedAt, systems }
  },

  async collect({ protocol, ctx, prepared }) {
    const id = ctx.mapping[protocol.id]?.[0]
    if (!id) return null
    const reading = prepared.systems.get(id)
    if (!reading) throw new Error(`${id} was not read`)
    if (reading instanceof Error) throw reading
    const { system, delay, timelock, facts } = reading

    const observed = `Read from Ethereum mainnet at block ${prepared.block}.`
    const note = timelock
      ? `The headline is the delay the ${timelock.label} of ${system.name} enforces before a scheduled action executes, in seconds. ${observed}`
      : `None of the contracts read for ${system.name} is a timelock, so the headline stays empty; the facts list what they report. ${observed}`

    return {
      value: delay,
      updatedAt: prepared.observedAt,
      url: `${ETHERSCAN}${(timelock ?? system.contracts[0])?.address}`,
      note,
      extra: { facts },
    }
  },
}

export default adapter
