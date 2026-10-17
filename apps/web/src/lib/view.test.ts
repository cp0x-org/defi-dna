import { describe, expect, it } from 'vitest'
import {
  DAY,
  ageLabel,
  assessesLabel,
  categoryLabel,
  colourSlot,
  coverageLabel,
  dateInfo,
  dayAndTime,
  hostOf,
  safeUrl,
  timeLabel,
} from './view.ts'

const NOW = Date.parse('2026-10-11T12:00:00.000Z')

describe('labels', () => {
  it('prettifies known categories and passes unknown ones through', () => {
    expect(categoryLabel('dex')).toBe('DEX / AMM')
    expect(categoryLabel('restaking')).toBe('restaking')
  })

  it('names what a feed assesses and the three cell states', () => {
    expect(assessesLabel('vault')).toBe('individual vaults, not the protocol')
    expect(coverageLabel('ok')).toBe('Data available')
    expect(coverageLabel('none')).toBe('No data')
    expect(coverageLabel('error')).toBe('Collection error')
  })

  it('gives every id the same colour slot, one of five', () => {
    expect(colourSlot('pigi')).toBe(colourSlot('pigi'))
    for (const id of ['pigi', 'defiscan', 'philidor', 'risklayer', 'x']) {
      expect(colourSlot(id)).toBeGreaterThanOrEqual(0)
      expect(colourSlot(id)).toBeLessThan(5)
    }
  })
})

describe('safeUrl', () => {
  it('keeps http and https links', () => {
    expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(safeUrl('http://example.com')).toBe('http://example.com/')
  })

  it('drops other schemes, relative paths and empty values', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeUrl('data:text/html,hi')).toBeUndefined()
    expect(safeUrl('/protocol/aave-v3')).toBeUndefined()
    expect(safeUrl('')).toBeUndefined()
    expect(safeUrl(null)).toBeUndefined()
    expect(safeUrl()).toBeUndefined()
  })
})

describe('hostOf', () => {
  it('names the host of a link, without www', () => {
    expect(hostOf('https://www.defillama.com/protocol/aave-v3')).toBe('defillama.com')
    expect(hostOf('http://app.example.org:8080/x')).toBe('app.example.org:8080')
  })

  it('names nothing that ExternalLink would refuse to open', () => {
    expect(hostOf('javascript:alert(1)')).toBeNull()
    expect(hostOf('not a url')).toBeNull()
    expect(hostOf(undefined)).toBeNull()
  })
})

describe('dateInfo', () => {
  const unknown = { label: 'Date unavailable', age: null, older: false }

  it('renders a day and counts its age in whole days', () => {
    expect(dateInfo('2026-10-11', NOW)).toEqual({ label: '11 Oct 2026', age: 0, older: false })
    expect(dateInfo('2026-10-01T08:00:00Z', NOW)).toEqual({
      label: '1 Oct 2026',
      age: 10,
      older: false,
    })
  })

  it('renders a month-only date without a day', () => {
    expect(dateInfo('2026-09', NOW)).toEqual({ label: 'Sept 2026', age: 40, older: false })
  })

  it('marks a date older than 90 days, and only then', () => {
    expect(dateInfo(new Date(NOW - 90 * DAY).toISOString(), NOW).older).toBe(false)
    expect(dateInfo(new Date(NOW - 91 * DAY).toISOString(), NOW).older).toBe(true)
  })

  it('reports no date rather than a wrong one', () => {
    expect(dateInfo(undefined, NOW)).toEqual(unknown)
    expect(dateInfo(null, NOW)).toEqual(unknown)
    expect(dateInfo('yesterday', NOW)).toEqual(unknown)
    expect(dateInfo('1970-01-01T00:00:00Z', NOW)).toEqual(unknown)
    expect(dateInfo('2026-13-40', NOW)).toEqual(unknown)
    expect(dateInfo(new Date(NOW + 2 * DAY).toISOString(), NOW)).toEqual(unknown)
  })

  it('accepts a date up to a day ahead, for clocks and time zones', () => {
    expect(dateInfo(new Date(NOW + DAY / 2).toISOString(), NOW).age).toBe(0)
  })
})

describe('ageLabel', () => {
  it('uses minutes, then hours, then days', () => {
    expect(ageLabel(new Date(NOW - 40 * 60_000).toISOString(), NOW)).toBe('40m')
    expect(ageLabel(new Date(NOW - 5 * 3_600_000).toISOString(), NOW)).toBe('5h')
    expect(ageLabel(new Date(NOW - 12 * DAY).toISOString(), NOW)).toBe('12d')
  })

  it('never goes negative and has nothing to say about a missing time', () => {
    expect(ageLabel(new Date(NOW + 60_000).toISOString(), NOW)).toBe('0m')
    expect(ageLabel(undefined, NOW)).toBeNull()
    expect(ageLabel('not a date', NOW)).toBeNull()
  })
})

describe('timeLabel', () => {
  it('prints the day and the UTC time', () => {
    expect(timeLabel('2026-10-11T13:36:00.000Z')).toBe('11 Oct 2026 · 13:36 UTC')
  })

  it('has nothing to say about a missing or broken time', () => {
    expect(timeLabel(undefined)).toBeNull()
    expect(timeLabel('')).toBeNull()
    expect(timeLabel('not a date')).toBeNull()
  })
})

describe('dayAndTime', () => {
  it('splits a timestamp into its UTC day and time', () => {
    expect(dayAndTime('2026-10-11T23:15:00.000Z')).toEqual(['11 Oct', '23:15 UTC'])
  })
})
