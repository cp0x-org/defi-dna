import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SITE = 'https://site.test/app/'

/** A fake network: url -> JSON body, or a bare status for a failed response. */
type Routes = Record<string, unknown>
const failed = (status: number) => ({ failedWith: status })

const fakeFetch = (routes: Routes) =>
  vi.fn(async (url: string) => {
    const body = Object.hasOwn(routes, url) ? routes[url] : failed(404)
    const status =
      body && typeof body === 'object' && 'failedWith' in body ? Number(body.failedWith) : 200
    return { ok: status === 200, status, json: async () => body }
  })

/** Module state (configured location, cache) lives for a page load; each test gets a fresh one. */
const client = async (routes: Routes, configUrl = '/app/config.json') => {
  const fetch = fakeFetch(routes)
  vi.stubGlobal('fetch', fetch)
  const module = await import('./index.ts')
  module.configureDataClient({ configUrl })
  return { ...module, fetch }
}

const requested = (fetch: ReturnType<typeof fakeFetch>) => fetch.mock.calls.map(([url]) => url)

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('location', { href: SITE })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('data location', () => {
  it('reads a relative dataUrl next to config.json', async () => {
    const index = { generatedAt: '2026-10-11T00:00:00Z', rows: [] }
    const { loadIndex, fetch } = await client({
      '/app/config.json': { dataUrl: './data' },
      'https://site.test/app/data/index.json': index,
    })
    await expect(loadIndex()).resolves.toEqual(index)
    expect(requested(fetch)).toEqual(['/app/config.json', 'https://site.test/app/data/index.json'])
  })

  it('reads an absolute dataUrl written without a trailing slash', async () => {
    const { loadIndex, fetch } = await client({
      '/app/config.json': { dataUrl: 'https://raw.example/org/repo/main/data' },
      'https://raw.example/org/repo/main/data/index.json': { generatedAt: '', rows: [] },
    })
    await loadIndex()
    expect(requested(fetch)).toContain('https://raw.example/org/repo/main/data/index.json')
  })

  it('falls back to ./data when config.json is missing', async () => {
    const { loadIndex, fetch } = await client({
      'https://site.test/app/data/index.json': { generatedAt: '', rows: [] },
    })
    await loadIndex()
    expect(requested(fetch)).toEqual(['/app/config.json', 'https://site.test/app/data/index.json'])
  })
})

describe('loading', () => {
  it('requests each file once per page load', async () => {
    const { loadIndex, loadChangelog, fetch } = await client({
      '/app/config.json': {},
      'https://site.test/app/data/index.json': { generatedAt: '', rows: [] },
      'https://site.test/app/data/changelog.json': [],
    })
    await Promise.all([loadIndex(), loadIndex(), loadChangelog()])
    await loadIndex()
    expect(requested(fetch)).toEqual([
      '/app/config.json',
      'https://site.test/app/data/index.json',
      'https://site.test/app/data/changelog.json',
    ])
  })

  it('reports a failed response with its status and url', async () => {
    const { loadChangelog } = await client({
      '/app/config.json': {},
      'https://site.test/app/data/changelog.json': failed(500),
    })
    await expect(loadChangelog()).rejects.toThrow(
      '500 while loading https://site.test/app/data/changelog.json',
    )
  })

  it('joins a protocol record with that protocol’s metrics only', async () => {
    const tvl = { value: 1e9, fetchedAt: '2026-10-11T00:00:00Z' }
    const { loadProtocol } = await client({
      '/app/config.json': {},
      'https://site.test/app/data/protocols/aave-v3.json': { protocolId: 'aave-v3', feeds: {} },
      'https://site.test/app/data/protocols/lido.json': { protocolId: 'lido', feeds: {} },
      'https://site.test/app/data/metrics.json': { 'aave-v3': { tvl }, curve: { tvl } },
    })
    await expect(loadProtocol('aave-v3')).resolves.toEqual({
      protocolId: 'aave-v3',
      feeds: {},
      metrics: { tvl },
    })
    await expect(loadProtocol('lido')).resolves.toEqual({
      protocolId: 'lido',
      feeds: {},
      metrics: {},
    })
  })
})
