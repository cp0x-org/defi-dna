import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { paths } from './registry.ts'
import type { FetchOptions, PostOptions } from './types.ts'

const USER_AGENT =
  'defi-dna-aggregator/0.1 (+https://github.com/cp0x-org/defi-dna) risk feed aggregation'
const DEFAULT_TTL = 3600
const DEFAULT_RETRIES = 2
/** Longest we sit out a rate-limit window before giving up on a request. */
const MAX_WAIT_MS = 60_000

interface CacheEntry {
  /** The URL, prefixed with `POST ` and followed by `request` for a cached POST. */
  url: string
  request?: string
  storedAt: number
  status: number
  body: string
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * A URL as the log may show it. Keyed endpoints carry the key in the path
 * (`/eth/<64 hex>`, `/v3/<32 hex>`) or the query (`?apikey=…`), and the run
 * log of a public repository is public, so anything that looks like a key is
 * dropped; a protocol slug is shorter than that.
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const secret = /^[A-Za-z0-9_-]{24,}$/
    parsed.pathname = parsed.pathname
      .split('/')
      .map((segment) => (secret.test(segment) ? '***' : segment))
      .join('/')
    for (const [key, value] of parsed.searchParams) {
      if (secret.test(value) || /key|token|secret/i.test(key)) parsed.searchParams.set(key, '***')
    }
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Why a request failed, in one line. Node's fetch says only "fetch failed";
 * the reason — a DNS miss, a refused connection, a rejected certificate — is
 * in `cause`, sometimes two levels down, sometimes inside an AggregateError.
 */
export function explainError(error: unknown): string {
  if (error instanceof Error && error.name === 'TimeoutError') return 'timed out'
  const parts: string[] = []
  for (let current: unknown = error; current;) {
    const { code, cause, errors } = current as {
      code?: string
      cause?: unknown
      errors?: unknown[]
    }
    const text = current instanceof Error ? current.message : String(current)
    parts.push(code && !text.includes(code) ? `${text} (${code})` : text)
    current = cause ?? errors?.[0]
  }
  return parts.join(' — ')
}

/**
 * HTTP with an on-disk cache.
 *
 * The cache is what makes `--offline` work: a run with no network still
 * produces the same records from the last successful fetch. A response older
 * than its TTL is refreshed, and kept as a fallback if the refresh fails.
 */
export interface HttpOptions {
  offline?: boolean
  verbose?: boolean
  /** Where responses are cached. Default: the repository's .cache/http. */
  cacheDir?: string
  /** Retries after a failed request. Default: 2. */
  retries?: number
  /** The fetch to use; tests pass a fake. */
  fetch?: typeof fetch
}

export class Http {
  constructor(private readonly options: HttpOptions = {}) {}

  async getText(url: string, options: FetchOptions = {}): Promise<string> {
    return this.request({ url, options })
  }

  /**
   * One request through the cache. A GET is keyed by its URL (and range); a
   * POST by its URL and body, so two queries to one endpoint stay apart.
   */
  private async request({
    url,
    body,
    options,
  }: {
    url: string
    body?: string
    options: FetchOptions
  }): Promise<string> {
    const label = body === undefined ? url : `POST ${url}`
    // How the request is named in errors and logs: method, URL, no key.
    const shown = `${body === undefined ? 'GET' : 'POST'} ${redactUrl(url)}`
    const file = path.join(
      this.options.cacheDir ?? paths.cache,
      `${createHash('sha256')
        .update(body === undefined ? url + (options.rangeBytes ?? '') : `${label}\n${body}`)
        .digest('hex')
        .slice(0, 40)}.json`,
    )
    const cached = await read(file)
    const ttl = (options.ttlSeconds ?? DEFAULT_TTL) * 1000
    if (cached && (this.options.offline || Date.now() - cached.storedAt < ttl)) {
      return cached.body
    }
    if (this.options.offline) throw new Error(`offline and nothing cached for ${shown}`)

    const fetchImpl = this.options.fetch ?? fetch
    let lastError: unknown
    for (let attempt = 0; attempt <= (this.options.retries ?? DEFAULT_RETRIES); attempt++) {
      if (attempt > 0) await wait(500 * attempt)
      try {
        const headers: Record<string, string> = {
          ...(await options.headers?.()),
          'user-agent': USER_AGENT,
          accept: body === undefined ? '*/*' : 'application/json',
        }
        if (options.rangeBytes) headers.range = `bytes=${options.rangeBytes.join('-')}`
        if (body !== undefined) headers['content-type'] = 'application/json'
        const response = await fetchImpl(url, {
          ...(body === undefined ? {} : { method: 'POST', body }),
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
          // A query API names the cause in the body (`UNAUTHENTICATED`); it never echoes a key.
          const cause = body === undefined ? '' : `: ${(await response.text()).slice(0, 200)}`
          const failure = new Error(`HTTP ${response.status} for ${shown}${cause}`)
          lastError = failure
          if (this.options.verbose) console.warn(`  retry ${attempt + 1}: ${failure.message}`)
          continue
        }
        const text = await response.text()
        await write(file, {
          url: label,
          ...(body === undefined ? {} : { request: body }),
          storedAt: Date.now(),
          status: response.status,
          body: text,
        })
        return text
      } catch (error) {
        const failure = new Error(`${shown}: ${explainError(error)}`, { cause: error })
        lastError = failure
        if (this.options.verbose) console.warn(`  retry ${attempt + 1}: ${failure.message}`)
      }
    }
    // Network trouble, but we have an older copy: serving it beats emptying a
    // cell that is genuinely covered. Said out loud, or a source that is down
    // looks healthy for as long as the copies last.
    if (cached) {
      console.warn(
        `  stale: ${lastError instanceof Error ? lastError.message : shown}; serving the copy stored ${new Date(cached.storedAt).toISOString().slice(0, 10)}`,
      )
      return cached.body
    }
    throw lastError instanceof Error ? lastError : new Error(`${shown}: no response`)
  }

  async getJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
    const text = await this.getText(url, options)
    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(`response from GET ${redactUrl(url)} is not valid JSON`)
    }
  }

  /**
   * POST a JSON body. Without `ttlSeconds` it is never cached and never
   * retried: that form exchanges an API key for a token, and a token has no
   * business on disk. With `ttlSeconds` it goes through the cache like a GET,
   * for an API that answers queries only to POST (GraphQL): the response
   * replays offline and `headers` is asked for only on the network.
   */
  async postJson<T>(url: string, body: unknown, options: PostOptions = {}): Promise<T> {
    if (options.ttlSeconds !== undefined) {
      const text = await this.request({ url, body: JSON.stringify(body), options })
      try {
        return JSON.parse(text) as T
      } catch {
        throw new Error(`response from POST ${redactUrl(url)} is not valid JSON`)
      }
    }
    const shown = `POST ${redactUrl(url)}`
    if (this.options.offline) throw new Error(`offline: cannot ${shown}`)
    let response: Response
    try {
      response = await (this.options.fetch ?? fetch)(url, {
        method: 'POST',
        headers: {
          ...(await options.headers?.()),
          'user-agent': USER_AGENT,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      })
    } catch (error) {
      throw new Error(`${shown}: ${explainError(error)}`, { cause: error })
    }
    const text = await response.text()
    // The error body names the cause (`invalid_api_key`); it never echoes the key.
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${shown}: ${text.slice(0, 200)}`)
    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error(`response from ${shown} is not valid JSON`)
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
