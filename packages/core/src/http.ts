import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { paths } from './registry.ts'
import type { FetchOptions } from './types.ts'

const USER_AGENT =
  'defi-dna-aggregator/0.1 (+https://github.com/cp0x-org/defi-dna) risk feed aggregation'
const DEFAULT_TTL = 3600
const RETRIES = 2
/** Longest we sit out a rate-limit window before giving up on a request. */
const MAX_WAIT_MS = 60_000

interface CacheEntry {
  url: string
  storedAt: number
  status: number
  body: string
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * HTTP with an on-disk cache.
 *
 * The cache is what makes `--offline` work: a run with no network still
 * produces the same records from the last successful fetch. A response older
 * than its TTL is refreshed, and kept as a fallback if the refresh fails.
 */
export class Http {
  constructor(private readonly options: { offline?: boolean; verbose?: boolean } = {}) {}

  async getText(url: string, options: FetchOptions = {}): Promise<string> {
    const file = path.join(
      paths.cache,
      `${createHash('sha256')
        .update(url + (options.rangeBytes ?? ''))
        .digest('hex')
        .slice(0, 40)}.json`,
    )
    const cached = await read(file)
    const ttl = (options.ttlSeconds ?? DEFAULT_TTL) * 1000
    if (cached && (this.options.offline || Date.now() - cached.storedAt < ttl)) {
      return cached.body
    }
    if (this.options.offline) throw new Error(`offline and nothing cached for ${url}`)

    let lastError: unknown
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      if (attempt > 0) await wait(500 * attempt)
      try {
        const headers: Record<string, string> = { 'user-agent': USER_AGENT, accept: '*/*' }
        if (options.rangeBytes) headers.range = `bytes=${options.rangeBytes.join('-')}`
        const response = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(60_000),
        })
        if (response.status === 404 && options.allowNotFound) return ''
        // Sources publish their limits; waiting out the window is politer than
        // recording the cell as failed because we knocked too fast.
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after')) * 1000
          await wait(Math.min(retryAfter > 0 ? retryAfter : 30_000, MAX_WAIT_MS))
          continue
        }
        if (!response.ok && response.status !== 206) {
          throw new Error(`HTTP ${response.status} for ${url}`)
        }
        const body = await response.text()
        await write(file, { url, storedAt: Date.now(), status: response.status, body })
        return body
      } catch (error) {
        lastError = error
        if (this.options.verbose) console.warn(`  retry ${attempt + 1}: ${String(error)}`)
      }
    }
    // Network trouble, but we have an older copy: serving it beats emptying a
    // cell that is genuinely covered.
    if (cached) return cached.body
    throw lastError instanceof Error ? lastError : new Error(`failed to fetch ${url}`)
  }

  async getJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
    const text = await this.getText(url, options)
    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(`response from ${url} is not valid JSON`)
    }
  }
}

async function read(file: string): Promise<CacheEntry | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as CacheEntry
  } catch {
    return null
  }
}

async function write(file: string, entry: CacheEntry): Promise<void> {
  try {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(entry), 'utf8')
  } catch {
    /* a cache we cannot write is not a reason to fail the run */
  }
}
