import type { Change, ProtocolDetail } from '@defi-dna/data'
import { describe, expect, it } from 'vitest'
import { runsOf, summarizeRecord } from './record.ts'
import { feeds } from '../../shared/lib/registry.ts'

const incident = (date: string) => ({
  date,
  name: 'Example',
  amountUsd: 1,
  classification: 'Exploit',
  technique: 'Example',
  returnedFunds: null,
  source: null,
})

const cell = (status: 'ok' | 'error') => ({
  status,
  since: '2026-10-01T00:00:00.000Z' as const,
  value: 'x',
})

describe('summarizeRecord', () => {
  const present = feeds[0]
  const failed = feeds[1]
  if (!present || !failed) throw new Error('the registry has fewer than two feeds')

  const record: ProtocolDetail = {
    protocolId: 'example',
    feeds: { [present.id]: cell('ok'), [failed.id]: cell('error') },
    metrics: {
      incidents: {
        value: 2,
        fetchedAt: '2026-10-01T00:00:00.000Z',
        extra: { incidents: [incident('2023-01-01'), incident('2024-06-01')] },
      },
    },
  }

  it('counts feeds with data and feeds we failed to read, in registry order', () => {
    const summary = summarizeRecord(record)
    expect(summary.tones).toHaveLength(feeds.length)
    expect(summary.withData.map((feed) => feed.id)).toEqual([present.id])
    expect(summary.errors.map((feed) => feed.id)).toEqual([failed.id])
    const tone = (id: string) => summary.tones[feeds.findIndex((feed) => feed.id === id)]
    expect(tone(present.id)).not.toBe('none')
    expect(tone(present.id)).not.toBe('error')
    expect(tone(failed.id)).toBe('error')
    const untouched = feeds.find((feed) => feed.id !== present.id && feed.id !== failed.id)
    if (untouched) expect(tone(untouched.id)).toBe('none')
  })

  it('picks DefiLlama’s newest incident, and none when the list was not read', () => {
    expect(summarizeRecord(record).latestIncident?.date).toBe('2024-06-01')
    expect(summarizeRecord({ ...record, metrics: null }).latestIncident).toBeUndefined()
    expect(summarizeRecord({ ...record, metrics: {} }).latestIncident).toBeUndefined()
  })
})

describe('runsOf', () => {
  const move = (ts: string, feedId: string, from: string | null, to: string): Change => ({
    ts,
    protocolId: 'aave-v3',
    protocolName: 'Aave v3',
    feedId,
    from,
    to,
  })

  it('folds back-to-back moves of one feed and keeps every entry, newest first', () => {
    const log = [
      move('2026-11-02T05:00:00Z', 'defiscoring', '47', '48'),
      move('2026-11-01T05:00:00Z', 'defiscoring', '46', '47'),
      move('2026-10-31T05:00:00Z', 'defiscoring', '45', '46'),
      move('2026-10-30T05:00:00Z', 'pigi', 'B 83', 'B 82'),
      move('2026-10-29T05:00:00Z', 'defiscoring', null, '45'),
    ]
    const runs = runsOf(log)
    expect(runs.map((run) => [run.feedId, run.entries.length])).toEqual([
      ['defiscoring', 3],
      ['pigi', 1],
      ['defiscoring', 1],
    ])
    expect(runs[0]?.entries[0]).toBe(log[0])
    expect(runs[0]?.entries[2]).toBe(log[2])
    expect(runs.flatMap((run) => run.entries)).toEqual(log)
  })

  it('answers an empty log with no runs', () => {
    expect(runsOf([])).toEqual([])
  })
})
