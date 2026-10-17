import type { FeedData } from '@defi-dna/data'
import { describe, expect, it } from 'vitest'
import { feeds } from './registry.ts'
import { detailToneOf, signalCounts, toneFromIndex, toneOf, type Tone } from './status.ts'

const feed = (id: string) => {
  const found = feeds.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no feed ${id}`)
  return found
}
const ok = (value: string): FeedData => ({ status: 'ok', value, since: '2026-10-11T00:00:00Z' })
const read = (id: string, value: string): Tone => toneOf(feed(id), ok(value))

describe('toneOf', () => {
  it('reads a headline on the feed’s own published scale', () => {
    expect(read('defiscoring', '37 · red')).toBe('neg')
    expect(read('defiscoring', '62 · yellow')).toBe('neu')
    expect(read('defiscoring', '85 · green')).toBe('pos')
    expect(read('risklayer', '5.9/10 · high')).toBe('neg')
    expect(read('risklayer', '4.8/10 · medium')).toBe('neu')
    expect(read('risklayer', '2.1/10 · low')).toBe('pos')
    expect(read('pigi', 'A 86.41/100')).toBe('pos')
    expect(read('pigi', 'B 83.64/100')).toBe('pos')
    expect(read('pigi', 'C 67.88/100')).toBe('neu')
    expect(read('pigi', 'D 50.16/100')).toBe('neg')
  })

  it('leaves data neutral where the scale gives no reading, and never guesses', () => {
    expect(read('philidor', '46 vaults rated')).toBe('inf')
    expect(read('defiscan', '33 admins · $49.0M capital at risk')).toBe('inf')
    expect(read('risklayer', '7.1/10 · critical')).toBe('inf')
    expect(read('pigi', '1 vaults rated')).toBe('inf')
  })

  it('keeps no data grey and our own failure apart', () => {
    expect(toneOf(feed('pigi'))).toBe('none')
    expect(toneOf(feed('pigi'), { status: 'none', since: '2026-10-11T00:00:00Z' })).toBe('none')
    expect(toneOf(feed('pigi'), { status: 'error', since: '2026-10-11T00:00:00Z' })).toBe('error')
  })
})

describe('detailToneOf', () => {
  it('reads a slice grade on DeFiPunk’d’s own scale, tentative or not', () => {
    const punkd = feed('defipunkd')
    expect(detailToneOf(punkd, 'green')).toBe('pos')
    expect(detailToneOf(punkd, 'tentative green')).toBe('pos')
    expect(detailToneOf(punkd, 'tentative orange')).toBe('neu')
    expect(detailToneOf(punkd, 'tentative orange (3/3 models submitted)')).toBe('neu')
    expect(detailToneOf(punkd, 'tentative red')).toBe('neg')
  })

  it('leaves an ungraded slice and a feed without a rule uncoloured', () => {
    expect(detailToneOf(feed('defipunkd'), 'unknown')).toBeNull()
    expect(detailToneOf(feed('defipunkd'), 'tentative unknown (2/3 models submitted)')).toBeNull()
    expect(detailToneOf(feed('pigi'), 'green')).toBeNull()
  })
})

describe('toneFromIndex', () => {
  it('reads the bundle’s copy, and treats an older index without readings as neutral', () => {
    const row = { feeds: { pigi: true, defiscan: true }, readings: { pigi: 'negative' as const } }
    expect(toneFromIndex(row, 'pigi')).toBe('neg')
    expect(toneFromIndex(row, 'defiscan')).toBe('inf')
    expect(toneFromIndex(row, 'philidor')).toBe('none')
    expect(toneFromIndex({ feeds: { pigi: true } }, 'pigi')).toBe('inf')
  })
})

describe('signalCounts', () => {
  it('keeps each group apart and puts data without a reading with neutral', () => {
    expect(signalCounts(['neg', 'inf', 'neu', 'pos', 'none', 'error'])).toEqual({
      neg: 1,
      neu: 2,
      pos: 1,
    })
  })
})
