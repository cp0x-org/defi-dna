import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Http } from './http.ts'

let cacheDir: string
beforeEach(async () => {
  cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'defi-dna-http-'))
})
afterEach(() => fs.rm(cacheDir, { recursive: true, force: true }))

/** A fetch that answers from a script and records what was asked. */
const scripted = (answers: (() => Response)[]) => {
  const calls: string[] = []
  const impl = (async (url: string | URL | Request) => {
    calls.push(String(url))
    const next = answers.shift()
    if (!next) throw new Error('no answer scripted')
    return next()
  }) as typeof fetch
  return { calls, fetch: impl }
}
const ok = (body: string) => () => new Response(body, { status: 200 })
const down = () => () => {
  throw new Error('ECONNRESET')
}

const URL_ = 'https://example.com/data'

describe('Http', () => {
  it('caches a response on disk and serves it within its TTL without fetching', async () => {
    const { calls, fetch } = scripted([ok('one')])
    const http = new Http({ cacheDir, fetch })
    expect(await http.getText(URL_)).toBe('one')
    expect(await http.getText(URL_)).toBe('one')
    expect(calls).toHaveLength(1)
  })

  it('refreshes an expired copy and falls back to it when the refresh fails', async () => {
    const { calls, fetch } = scripted([ok('one'), ok('two'), down()])
    const http = new Http({ cacheDir, fetch, retries: 0 })
    expect(await http.getText(URL_, { ttlSeconds: 0 })).toBe('one')
    expect(await http.getText(URL_, { ttlSeconds: 0 })).toBe('two')
    expect(await http.getText(URL_, { ttlSeconds: 0 })).toBe('two') // the network failed; the copy stands
    expect(calls).toHaveLength(3)
  })

  it('offline serves the cache, whatever its age, and refuses the network', async () => {
    const { fetch } = scripted([ok('one')])
    await new Http({ cacheDir, fetch }).getText(URL_)
    const offline = new Http({ cacheDir, fetch, offline: true })
    expect(await offline.getText(URL_, { ttlSeconds: 0 })).toBe('one')
    await expect(offline.getText('https://example.com/other')).rejects.toThrow('offline')
    await expect(offline.postJson('https://example.com/token', {})).rejects.toThrow('offline')
  })

  it('asks for request headers only when it really goes to the network', async () => {
    const { fetch } = scripted([ok('{"n":1}')])
    const http = new Http({ cacheDir, fetch })
    let minted = 0
    const headers = async () => {
      minted++
      return { authorization: 'Bearer t' }
    }
    expect(await http.getJson(URL_, { headers })).toEqual({ n: 1 })
    expect(await http.getJson(URL_, { headers })).toEqual({ n: 1 })
    expect(minted).toBe(1)
  })

  it('treats a 404 as empty only when asked, and never caches a POST', async () => {
    const notFound = () => new Response('', { status: 404 })
    const { calls, fetch } = scripted([
      notFound,
      notFound,
      ok('{"token":"a"}'),
      ok('{"token":"b"}'),
    ])
    const http = new Http({ cacheDir, fetch, retries: 0 })
    expect(await http.getText(URL_, { allowNotFound: true })).toBe('')
    await expect(http.getText(URL_)).rejects.toThrow('HTTP 404')
    expect(await http.postJson('https://example.com/token', { key: 'k' })).toEqual({ token: 'a' })
    expect(await http.postJson('https://example.com/token', { key: 'k' })).toEqual({ token: 'b' })
    expect(calls).toHaveLength(4)
  })
})
