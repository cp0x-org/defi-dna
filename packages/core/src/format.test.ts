import { describe, expect, it } from 'vitest'
import { formatDuration, formatUsd } from './format.ts'

describe('formatDuration', () => {
  it('picks the unit a reader scans fastest and never hides a value', () => {
    expect(formatDuration(0)).toBe('0 s')
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(900)).toBe('15 min')
    expect(formatDuration(5400)).toBe('1.5 h')
    expect(formatDuration(86400)).toBe('1 day')
    expect(formatDuration(172800)).toBe('2 days')
    expect(formatDuration(345600)).toBe('4 days')
    expect(formatDuration(129600)).toBe('1.5 days')
  })

  it('returns null for anything that is not a duration', () => {
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(undefined)).toBeNull()
    expect(formatDuration(-1)).toBeNull()
    expect(formatDuration(Number.NaN)).toBeNull()
  })
})

describe('formatUsd', () => {
  it('keeps its rounding by magnitude', () => {
    expect(formatUsd(15272106283)).toBe('$15.27B')
    expect(formatUsd(null)).toBeNull()
  })
})
