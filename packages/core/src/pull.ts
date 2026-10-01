import fs from 'node:fs/promises'
import path from 'node:path'
import { paths, readJson } from './registry.ts'
import type { Protocol } from './types.ts'

/**
 * Download the published data into data/. `bundle()` then copies it to the web
 * app, rebuilding the index against the local registry — so a feed or protocol
 * added here but not yet published still gets its row and column.
 *
 * Generated data is never committed to this repository: the refresh workflow
 * publishes it to the data repository named in `configs/config.json`, and the
 * deployed site reads it from there. This makes a local copy of it, so the
 * local site — and a local `collect`, which carries previous values forward —
 * start from what is published. Local generated files are replaced.
 */
export async function pull(): Promise<{ source: string; records: number }> {
  const { dataUrl } = await readJson<{ dataUrl?: string }>(paths.config)
  if (!dataUrl) throw new Error(`${paths.config} names no dataUrl`)
  const source = dataUrl.replace(/\/+$/, '')
  const { protocols } = await readJson<{ protocols: Protocol[] }>(paths.protocols)

  // Read everything first: a failed download leaves the local copy untouched.
  const changelog = await download(`${source}/changelog.json`)
  const records = await Promise.all(
    protocols.map(async ({ id }) => ({
      id,
      body: await download(`${source}/protocols/${id}.json`),
    })),
  )

  await fs.rm(paths.records, { recursive: true, force: true })
  await fs.rm(paths.webData, { recursive: true, force: true })
  await fs.mkdir(paths.records, { recursive: true })
  let written = 0
  for (const { id, body } of records) {
    // A protocol the published data has no record for yet is simply absent.
    if (body == null) continue
    await fs.writeFile(path.join(paths.records, `${id}.json`), body, 'utf8')
    written++
  }
  await fs.writeFile(paths.changelog, changelog ?? '[]\n', 'utf8')
  return { source, records: written }
}

async function download(url: string): Promise<string | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}
