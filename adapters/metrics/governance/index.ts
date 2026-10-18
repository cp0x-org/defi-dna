import {
  formatDuration,
  type AdapterContext,
  type Detail,
  type ExtraGovernanceBody,
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
 * Function selectors of every view systems.json may name: the first four
 * bytes of keccak256 of the signature (`cast sig`). Kept as constants: the
 * pipeline has no keccak and no ABI library, and these do not change. A new
 * view in systems.json needs its line here.
 */
const SELECTOR: Record<string, string> = {
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
  'getVotingConfig(uint8)': '0x1c84e321',
  'hat()': '0xfe95a5ce',
  'live()': '0x957aa58c',
  'GOV()': '0x180cb47f',
  'token()': '0xfc0c546a',
  'getVoteDelayTime()': '0x10f66424',
  'getVotePhase1Time()': '0xfb587022',
  'getVotePhase2Time()': '0x1e0aa3f2',
  'getExecuteTime()': '0x0a092a4e',
  'getProposalQuorum()': '0x8e0add62',
  'getProposalVetoQuorum()': '0xde249462',
  'getProposalBond()': '0x1b61cd22',
}

/* ------------------------------------------------------------- systems.json */

/** How the word a view returns is read; systems.json documents each. */
type Shape = 'seconds' | 'count' | 'tokens' | 'percent' | 'address' | 'account' | 'enum' | 'signers'

/** One view call on one contract, and the fact it becomes. */
interface Read {
  /** A Solidity signature, or two when one fact needs two views (`signers`). */
  call: string | string[]
  /** Arguments in order: a uint, a 0x-prefixed bytes32 word, or `$previousBlock`. */
  args?: (number | string)[]
  /** Which 32-byte word of the answer to read; 0 unless the view returns a tuple. */
  word?: number
  as: Shape
  /** `count` and `tokens`: the unit printed after the number. */
  unit?: string
  /** `enum`: the names, in the contract's order. */
  values?: string[]
  fact: string
  /** A `seconds` read whose value is the headline. Several add up (Lido). */
  headline?: boolean
}

/** What a contract is, so the page can say who decides; the reads are what prove it. */
type ContractType =
  | 'timelock'
  | 'governor'
  | 'aragon-voting'
  | 'dual-governance'
  | 'safe'
  | 'holder'
  | 'registry'
  | 'council'
const CONTRACT_TYPES: ContractType[] = [
  'timelock',
  'governor',
  'aragon-voting',
  'dual-governance',
  'safe',
  'holder',
  'registry',
  'council',
]

interface Contract {
  label: string
  address: string
  type: ContractType
  /** `governor`, `aragon-voting`, `dual-governance`: the token that votes (or vetoes). */
  token?: string
  reads: Read[]
}

interface System {
  name: string
  source: string
  /** Where token holders vote when no contract reports it: appended to the note, never a value. */
  voting?: { note: string; url?: string }
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
 * goes out as one POST. The reads of a system run concurrently, so a system
 * costs one or two round trips instead of one per view. The body is
 * deterministic, so the HTTP cache replays a run offline. The same call is
 * sent once per run (systems.json names a tuple view once per word).
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
  const seen = new Map<string, Promise<string | null>>()

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
    call(to, data) {
      const key = `${to.toLowerCase()} ${data}`
      let pending = seen.get(key)
      if (!pending) {
        pending = request<string | null>('eth_call', [{ to, data }, 'latest']).then((result) =>
          typeof result === 'string' && result.length > 2 ? result : null,
        )
        seen.set(key, pending)
      }
      return pending
    },
    code: (address) => request<string>('eth_getCode', [address, 'latest']),
  }
}

/* --------------------------------------------------------------- ABI coding */

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

const encodeUint = (value: number | bigint): string => value.toString(16).padStart(WORD, '0')

/** The arguments systems.json lists, as the 32-byte words that follow the selector. */
function encodeArgs(args: (number | string)[] | undefined, block: number): string {
  return (args ?? [])
    .map((arg) => {
      if (arg === '$previousBlock') return encodeUint(block - 1)
      if (typeof arg === 'number') return encodeUint(arg)
      if (/^0x[0-9a-fA-F]{64}$/.test(arg)) return arg.slice(2)
      throw new Error(`systems.json: cannot encode the argument ${JSON.stringify(arg)}`)
    })
    .join('')
}

/* ------------------------------------------------------------------ formats */

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

/* -------------------------------------------------------------------- reads */

/** A view named in systems.json: a revert means the address is not what the file says. */
async function must(rpc: Rpc, contract: Contract, signature: string, args: string) {
  const selector = SELECTOR[signature]
  if (!selector) throw new Error(`systems.json names ${signature}, which has no selector`)
  const result = await rpc.call(contract.address, selector + args)
  if (result === null)
    throw new Error(`${contract.label} (${contract.address}): ${signature} reverted`)
  return result
}

interface Account {
  text: string
  eoa?: true
  safe?: { threshold: number; signers: number }
}

/**
 * What kind of account holds a privileged role: an externally owned account,
 * a Safe (with its threshold), or some other contract. Facts a reader checks
 * on the explorer, not a judgement.
 */
async function describe(rpc: Rpc, address: string): Promise<Account> {
  const [code, threshold, owners] = await Promise.all([
    rpc.code(address),
    rpc.call(address, SELECTOR['getThreshold()'] as string),
    rpc.call(address, SELECTOR['getOwners()'] as string),
  ])
  if (code === '0x') return { text: `${address} (EOA)`, eoa: true }
  if (threshold && owners) {
    const safe = { threshold: Number(word(threshold)), signers: addressList(owners).length }
    return { text: `${address} (Safe, ${safe.threshold} of ${safe.signers} signers)`, safe }
  }
  return { text: `${address} (contract)` }
}

interface Outcome {
  fact: Detail
  /** Set on a headline read: the seconds it reports. */
  delay?: number
  /** Set when the read found a Safe or a single key holding a role. */
  body?: ExtraGovernanceBody
}

/** One read of systems.json, performed: the calls it names, decoded as it says. */
async function perform(rpc: Rpc, contract: Contract, read: Read, block: number): Promise<Outcome> {
  const calls = Array.isArray(read.call) ? read.call : [read.call]
  const args = encodeArgs(read.args, block)
  const answers = await Promise.all(calls.map((signature) => must(rpc, contract, signature, args)))
  const first = answers[0] as string
  const value = word(first, read.word ?? 0)
  // Where a reader repeats the read: the view, the contract, and the follow-up calls if any.
  const where = `${calls.join(' + ')} on ${contract.label} ${contract.address}`
  const fact = (shown: string, description = where): Detail => ({
    name: read.fact,
    value: shown,
    description,
  })
  if (read.headline && read.as !== 'seconds')
    throw new Error(`systems.json: "${read.fact}" is a headline but not read as seconds`)

  switch (read.as) {
    case 'seconds':
      return { fact: fact(seconds(value)), ...(read.headline ? { delay: Number(value) } : {}) }
    case 'count':
      return { fact: fact(`${value.toLocaleString('en-US')} ${read.unit ?? ''}`.trim()) }
    case 'tokens':
      return { fact: fact(tokens(value, read.unit ?? 'votes')) }
    case 'percent':
      return { fact: fact(percent(value)) }
    case 'address':
      return { fact: fact(addressAt(first, read.word ?? 0)) }
    case 'enum':
      return { fact: fact(read.values?.[Number(value)] ?? `${value}`) }
    case 'account': {
      const holder = addressAt(first, read.word ?? 0)
      const account = await describe(rpc, holder)
      return {
        fact: fact(
          account.text,
          `${where} · then eth_getCode, getThreshold() and getOwners() on the address returned`,
        ),
        ...(account.safe
          ? { body: { name: read.fact, address: holder, kind: 'multisig', ...account.safe } }
          : account.eoa
            ? { body: { name: read.fact, address: holder, kind: 'eoa' } }
            : {}),
      }
    }
    case 'signers': {
      const threshold = Number(value)
      const signers = addressList(answers[1] ?? first).length
      return {
        fact: fact(`${threshold} of ${signers} signers`),
        body: { name: read.fact, address: contract.address, kind: 'multisig', threshold, signers },
      }
    }
    default:
      throw new Error(`systems.json: "${read.fact}" has the unknown shape "${String(read.as)}"`)
  }
}

/* ------------------------------------------------------------------- adapter */

interface Reading {
  system: System
  /** Seconds the headline reads add up to; null when the system has none. */
  delay: number | null
  /** The contract the headline is read from. */
  timelock: Contract | null
  /** Facts in systems.json order: contract by contract, read by read. */
  facts: Detail[]
  /** Who decides, in the same order: a voting contract as such, a Safe or a key as the reads found it. */
  bodies: ExtraGovernanceBody[]
}

/** The body a contract is by its type: a token vote or a holder veto. Safes and keys come from the reads. */
function bodyOf(contract: Contract): ExtraGovernanceBody[] {
  if (!CONTRACT_TYPES.includes(contract.type))
    throw new Error(`systems.json: ${contract.label} has the unknown type "${contract.type}"`)
  const { label: name, address, token } = contract
  if (contract.type === 'governor' || contract.type === 'aragon-voting')
    return [{ name, address, kind: 'token-vote', ...(token ? { token } : {}) }]
  if (contract.type === 'dual-governance')
    return [{ name, address, kind: 'veto', ...(token ? { token } : {}) }]
  return []
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
 * Nothing here decides what to read. systems.json lists, per governance
 * system, every contract and every view called on it, and mapping.json says
 * which system decides over which protocol version; this file performs those
 * reads in that order and formats the words that come back. Every number is
 * what the contract returned at the block named in `note`. Reading them is a
 * measurement, not a verdict: a short delay or an EOA in a role is reported,
 * never scored.
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
    // One system at a time: its reads run together and go out in one or two
    // batched requests, so the endpoint sees a steady trickle.
    for (const id of new Set(Object.values(ctx.mapping).flat())) {
      const system = SYSTEMS[id]
      if (!system) throw new Error(`systems.json has no entry "${id}"`)
      try {
        const outcomes = await Promise.all(
          system.contracts.map(async (contract) => ({
            contract,
            results: await Promise.all(
              contract.reads.map((read) => perform(rpc, contract, read, block)),
            ),
          })),
        )
        const headline = outcomes.flatMap(({ contract, results }) =>
          results.filter((result) => result.delay != null).map((result) => ({ contract, result })),
        )
        const results = outcomes.flatMap((outcome) => outcome.results)
        systems.set(id, {
          system,
          delay: headline.length
            ? headline.reduce((sum, { result }) => sum + (result.delay ?? 0), 0)
            : null,
          timelock: headline[0]?.contract ?? null,
          facts: results.map((result) => result.fact),
          bodies: outcomes.flatMap(({ contract, results }) => [
            ...bodyOf(contract),
            ...results.flatMap((result) => (result.body ? [result.body] : [])),
          ]),
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
    const { system, delay, timelock, facts, bodies } = reading

    const observed = `Read from Ethereum mainnet at block ${prepared.block}.`
    const headlines = timelock
      ? timelock.reads.filter((read) => read.headline).map((read) => read.fact)
      : []
    const note = timelock
      ? headlines.length > 1
        ? `The headline is the sum of the delays the ${timelock.label} of ${system.name} enforces one after the other (${headlines.join(', ')}) before a scheduled action executes, in seconds. ${observed}`
        : `The headline is the delay the ${timelock.label} of ${system.name} enforces before a scheduled action executes, in seconds. ${observed}`
      : `None of the contracts read for ${system.name} is a timelock, so the headline stays empty; the facts list what they report. ${observed}`
    const voting = system.voting
      ? ` ${system.voting.note}${system.voting.url ? ` (${system.voting.url})` : ''}`
      : ''

    return {
      value: delay,
      updatedAt: prepared.observedAt,
      url: `${ETHERSCAN}${(timelock ?? system.contracts[0])?.address}`,
      note: note + voting,
      extra: { facts, ...(bodies.length > 0 ? { bodies } : {}) },
    }
  },
}

export default adapter
