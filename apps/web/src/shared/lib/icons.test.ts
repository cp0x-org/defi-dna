import { describe, expect, it } from 'vitest'
import { FEED_MONOCHROME, feedIconUrl, protocolIconUrl } from './icons.ts'

describe('protocolIconUrl', () => {
  it('resolves a version id to its group stem', () => {
    expect(protocolIconUrl('aave-v3')).toBeTruthy()
    expect(protocolIconUrl('aave-v3')).toBe(protocolIconUrl('aave-v4'))
    expect(protocolIconUrl('uniswap-v4')).toBe(protocolIconUrl('uniswap-v2'))
    expect(protocolIconUrl('morpho-vaults')).toBe(protocolIconUrl('morpho-blue'))
  })

  it('resolves dashboard group keys case-insensitively', () => {
    expect(protocolIconUrl('Aave')).toBe(protocolIconUrl('aave-v3'))
    expect(protocolIconUrl('Morpho')).toBe(protocolIconUrl('morpho-blue'))
  })

  it('resolves ids that match a filename exactly', () => {
    expect(protocolIconUrl('cowswap')).toBeTruthy()
    expect(protocolIconUrl('oneinch')).toBeTruthy()
    expect(protocolIconUrl('zerox')).toBeTruthy()
    expect(protocolIconUrl('cowswap')).not.toBe(protocolIconUrl('zerox'))
  })
})

describe('feedIconUrl', () => {
  it('resolves known feeds and leaves gaps for missing marks', () => {
    expect(feedIconUrl('pigi')).toBeTruthy()
    expect(feedIconUrl('defipunkd')).toBeTruthy()
    expect(feedIconUrl('credora')).toBeTruthy()
    expect(feedIconUrl('risklayer')).toBeUndefined()
  })

  it('marks single-colour feeds for dark-theme invert', () => {
    expect(FEED_MONOCHROME.has('defipunkd')).toBe(true)
    expect(FEED_MONOCHROME.has('pigi')).toBe(true)
    expect(FEED_MONOCHROME.has('credora')).toBe(false)
  })
})
