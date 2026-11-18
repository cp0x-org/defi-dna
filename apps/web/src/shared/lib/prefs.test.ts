import { afterEach, describe, expect, it, vi } from 'vitest'
import { readHiddenColumns, writeHiddenColumns } from './prefs.ts'

/** The browser pieces prefs.ts touches, so a test can set a stored choice. */
const browser = (stored: Record<string, string>) => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored[key] ?? null,
    setItem: (key: string, value: string) => {
      stored[key] = value
    },
  })
  vi.stubGlobal('document', { cookie: '' })
}

describe('readHiddenColumns', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('hides Governance until the visitor has made a choice', () => {
    browser({})
    expect([...readHiddenColumns()]).toEqual(['governance'])
  })

  it('keeps a saved choice, including the choice to show everything', () => {
    const stored: Record<string, string> = {}
    browser(stored)
    writeHiddenColumns(new Set())
    expect([...readHiddenColumns()]).toEqual([])
    writeHiddenColumns(new Set(['tvl', 'incidents']))
    expect([...readHiddenColumns()]).toEqual(['tvl', 'incidents'])
  })

  it('drops a stored column that no longer exists', () => {
    browser({ 'defi-dna-hidden-columns': 'signals,updated,category' })
    expect([...readHiddenColumns()]).toEqual(['category'])
  })
})
