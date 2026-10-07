import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ASSESSED_OBJECTS, type Feed, type Protocol } from './types.ts'
import { listAdapters, normalizeMapping, paths, readJson, readMapping } from './registry.ts'

describe('normalizeMapping', () => {
  it('turns strings into lists and skips comment keys', () => {
    expect(normalizeMapping({ _comment: 'x', a: 'one', b: ['two', 'three'] })).toEqual({
      a: ['one'],
      b: ['two', 'three'],
    })
  })

  it('rejects ids the registry does not know and empty values', () => {
    const known = new Set(['a'])
    expect(() => normalizeMapping({ typo: 'one' }, known)).toThrow('not a protocol id')
    expect(() => normalizeMapping({ a: '' }, known)).toThrow('non-empty')
    expect(() => normalizeMapping({ a: [] }, known)).toThrow('non-empty')
    expect(() => normalizeMapping({ a: 42 }, known)).toThrow('non-empty')
  })
})

/**
 * The hand-maintained files, checked in CI so a typo fails the pull request
 * rather than the scheduled refresh: every mapping key is a registry protocol,
 * every feed declares what it assesses.
 */
describe('adapter folders', () => {
  it('map only protocols from the registry', async () => {
    const { protocols } = await readJson<{ protocols: Protocol[] }>(paths.protocols)
    const known = new Set(protocols.map((protocol) => protocol.id))
    for (const group of [paths.feeds, paths.metrics]) {
      for (const id of await listAdapters(group)) {
        await expect(readMapping(path.join(group, id), known)).resolves.toBeTypeOf('object')
      }
    }
  })

  it('the template lists every registry protocol, so a new feed never guesses an id', async () => {
    const { protocols } = await readJson<{ protocols: Protocol[] }>(paths.protocols)
    const template = await readJson<Record<string, unknown>>(
      path.join(paths.feeds, '_template', 'mapping.json'),
    )
    const listed = Object.keys(template).filter((key) => !key.startsWith('_'))
    expect([...listed].sort()).toEqual(protocols.map((protocol) => protocol.id).sort())
    for (const id of listed) expect(template[`_${id}`], `comment for ${id}`).toBeTypeOf('string')
  })

  it('declare a known assessed object in feed.json', async () => {
    for (const id of await listAdapters(paths.feeds)) {
      const feed = await readJson<Feed>(path.join(paths.feeds, id, 'feed.json'))
      expect(feed.id).toBe(id)
      expect(ASSESSED_OBJECTS).toContain(feed.assesses)
    }
  })
})
