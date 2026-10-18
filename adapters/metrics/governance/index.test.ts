import { fakeContext } from '@defi-dna/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import answers from './fixtures/rpc.json' with { type: 'json' }
import adapter from './index.ts'

const RPC = 'https://rpc.test/eth'

interface Request {
  id: number
  method: string
  params: unknown[]
}

/**
 * Answers a JSON-RPC batch from the fixture, which holds real mainnet replies
 * keyed by method, address (lower-case) and calldata. A view the fixture does
 * not hold fails the test, as an unknown URL would.
 */
const node = (body: unknown) =>
  (body as Request[]).map(({ id, method, params }) => {
    const key =
      method === 'eth_call'
        ? `eth_call ${(params[0] as { to: string }).to.toLowerCase()} ${(params[0] as { data: string }).data}`
        : method === 'eth_getCode'
          ? `eth_getCode ${(params[0] as string).toLowerCase()}`
          : method
    if (!(key in answers)) throw new Error(`no fixture for ${key}`)
    const answer = (answers as Record<string, unknown>)[key]
    return answer && typeof answer === 'object' && 'error' in answer
      ? { id, jsonrpc: '2.0', ...answer }
      : { id, jsonrpc: '2.0', result: answer }
  })

const mapping = {
  'compound-v2': ['compound-governance'],
  'compound-v3': ['compound-governance'],
  'morpho-blue': ['morpho-dao'],
  lido: ['lido-dao'],
}

const protocol = (id: string) => ({ id, name: id, category: 'lending' })

describe('governance', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads the timelock delay and the facts around it, dated by the block', async () => {
    vi.stubEnv('ETH_RPC_URL', RPC)
    const ctx = fakeContext({ [`POST ${RPC}`]: node }, { mapping })
    const prepared = await adapter.prepare!(ctx)
    expect(prepared.block).toBe(26221607)

    const compound = await adapter.collect({ protocol: protocol('compound-v2'), ctx, prepared })
    expect(compound).toMatchObject({
      value: 172800,
      updatedAt: '2026-10-18T19:41:47.000Z',
      url: 'https://etherscan.io/address/0x6d903f6003cca6255D85CcA4D3B5E5146dC33925',
    })
    expect(compound?.note).toContain('Timelock of Compound governance')
    expect(compound?.note).toContain('block 26221607')
    expect(compound?.extra?.facts).toEqual([
      { name: 'Timelock delay', value: '172800 s (2 days)' },
      { name: 'Timelock admin', value: '0x309a862bbc1a00e45506cb8a802d1ff10004c8c0 (contract)' },
      { name: 'Governor voting delay', value: '13140 blocks' },
      { name: 'Governor voting period', value: '19710 blocks' },
      { name: 'Governor proposal threshold', value: '25,000 COMP' },
      { name: 'Governor quorum', value: '400,000 COMP' },
      { name: 'Community multisig', value: '5 of 9 signers' },
    ])

    // Two versions under one governance share the reading; the chain is asked once.
    const v3 = await adapter.collect({ protocol: protocol('compound-v3'), ctx, prepared })
    expect(v3?.value).toBe(172800)

    // Lido's timelock enforces two delays; the headline is their sum, the facts keep both.
    const lido = await adapter.collect({ protocol: protocol('lido'), ctx, prepared })
    expect(lido?.value).toBe(259200 + 86400)
    expect(lido?.extra?.facts).toEqual(
      expect.arrayContaining([
        { name: 'After-submit delay', value: '259200 s (3 days)' },
        { name: 'After-schedule delay', value: '86400 s (1 day)' },
        { name: 'Emergency mode', value: 'not active' },
        { name: 'Dual Governance state', value: 'Normal' },
        { name: 'Aragon voting support required', value: '50%' },
        { name: 'Reseal committee', value: '5 of 6 signers' },
      ]),
    )

    // Every request went to the configured endpoint, in batches: far fewer than one per view.
    expect(ctx.requests.every((url) => url === `POST ${RPC}`)).toBe(true)
    expect(ctx.requests.length).toBeLessThan(12)
  })

  it('keeps the headline empty where no contract read is a timelock, and describes the role holder', async () => {
    vi.stubEnv('ETH_RPC_URL', RPC)
    const ctx = fakeContext({ [`POST ${RPC}`]: node }, { mapping })
    const prepared = await adapter.prepare!(ctx)

    const morpho = await adapter.collect({ protocol: protocol('morpho-blue'), ctx, prepared })
    expect(morpho?.value).toBeNull()
    expect(morpho?.note).toContain('None of the contracts read for Morpho DAO is a timelock')
    expect(morpho?.extra?.facts).toEqual([
      {
        name: 'Morpho Blue owner',
        value: '0xcba28b38103307ec8da98377fff9816c164f9afa (Safe, 6 of 10 signers)',
      },
    ])

    expect(await adapter.collect({ protocol: protocol('liquity-v1'), ctx, prepared })).toBeNull()
  })

  it('fails the protocols of a system whose contract does not answer, not the run', async () => {
    vi.stubEnv('ETH_RPC_URL', RPC)
    const broken = (body: unknown) =>
      node(body).map((answer) =>
        'result' in answer &&
        answer.result === '0x000000000000000000000000000000000000000000000000000000000002a300'
          ? { id: answer.id, jsonrpc: '2.0', error: { code: 3, message: 'execution reverted' } }
          : answer,
      )
    const ctx = fakeContext({ [`POST ${RPC}`]: broken }, { mapping })
    const prepared = await adapter.prepare!(ctx)

    await expect(
      adapter.collect({ protocol: protocol('compound-v2'), ctx, prepared }),
    ).rejects.toThrow('Timelock (0x6d903f6003cca6255D85CcA4D3B5E5146dC33925): delay() reverted')
    const morpho = await adapter.collect({ protocol: protocol('morpho-blue'), ctx, prepared })
    expect(morpho?.extra?.facts).toHaveLength(1)
  })
})
