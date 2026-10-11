import type { AdapterContext, FetchOptions, Mapping } from './types.ts'

export interface FakeContextOptions {
  /** What `ctx.mapping` holds; the adapter's real mapping.json is not read. */
  mapping?: Mapping
  now?: Date
}

/**
 * An AdapterContext over canned responses, for tests.
 *
 * Keys are URLs (`POST <url>` for postJson) and values are bodies: an object
 * is served as JSON, a string as text, `null` as a 404. An unknown URL throws,
 * so a test fails loudly when the adapter asks for something the fixture does
 * not hold. The `headers` function of a request is invoked, as on the network,
 * so an adapter's credential path runs too. `requests` lists what was asked.
 */
export function fakeContext(
  responses: Record<string, unknown>,
  options: FakeContextOptions = {},
): AdapterContext & { requests: string[] } {
  const requests: string[] = []
  const serve = async (url: string, fetch: FetchOptions): Promise<string> => {
    requests.push(url)
    if (!(url in responses)) throw new Error(`no fixture for ${url}`)
    await fetch.headers?.()
    const value = responses[url]
    if (value === null) {
      if (fetch.allowNotFound) return ''
      throw new Error(`HTTP 404 for ${url}`)
    }
    return typeof value === 'string' ? value : JSON.stringify(value)
  }
  return {
    requests,
    mapping: options.mapping ?? {},
    now: options.now ?? new Date('2026-10-01T00:00:00.000Z'),
    log: () => {},
    getText: (url, fetch = {}) => serve(url, fetch),
    getJson: async <T>(url: string, fetch: FetchOptions = {}): Promise<T> =>
      JSON.parse(await serve(url, fetch)) as T,
    postJson: async <T>(url: string): Promise<T> => {
      const key = `POST ${url}`
      requests.push(key)
      if (!(key in responses)) throw new Error(`no fixture for ${key}`)
      return responses[key] as T
    },
  }
}
