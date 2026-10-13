import fs from 'node:fs/promises'
import path from 'node:path'
import { readRecord } from './collect.ts'
import { dataPaths, loadRegistry, paths, readJson, type Registry } from './registry.ts'
import { readStatus } from './status.ts'
import type {
  IndexBundle,
  IndexRow,
  MetricsFile,
  ProtocolRecord,
  Reading,
  RunStatus,
} from './types.ts'

export interface BundleOptions {
  /** Where the generated files live. Default: the repository's data/. */
  dataDir?: string
  /** Where the web app reads them from. Default: apps/web/public/data. */
  webDir?: string
  registry?: Registry
}

/**
 * Merge the per-protocol files into data/index.json and copy everything the
 * frontend reads at runtime into apps/web/public/data.
 *
 * This is the only place data from different protocols meets, and all it does
 * is copy per row the TVL figure and, per feed, whether it has data and how the
 * feed itself reads its value (the rule in its feed.json). Values are not
 * copied, nothing is combined into a score, and nothing hand-maintained is
 * copied in — names and grouping stay in registry/protocols.json.
 */
export async function bundle(
  options: BundleOptions = {},
): Promise<{ bundle: IndexBundle; records: ProtocolRecord[] }> {
  const registry = options.registry ?? (await loadRegistry())
  const data = dataPaths(options.dataDir)
  const webDir = options.webDir ?? paths.webData
  const feeds = registry.feeds.map(({ feed }) => feed)
  const metrics = await readJson<MetricsFile>(data.metricsData).catch(() => ({}) as MetricsFile)
  const status = await readJson<RunStatus>(data.status).catch(() => null)

  const records: ProtocolRecord[] = []
  const rows: IndexRow[] = []
  for (const protocol of registry.protocols) {
    const record = await readRecord(protocol.id, data.records)
    if (record) records.push(record)
    const readings: Record<string, Reading> = {}
    for (const feed of feeds) {
      const reading = readStatus(feed, record?.feeds[feed.id])
      if (reading) readings[feed.id] = reading
    }
    rows.push({
      id: protocol.id,
      tvl: metrics[protocol.id]?.['tvl']?.value ?? null,
      feeds: Object.fromEntries(feeds.map(({ id }) => [id, record?.feeds[id]?.status === 'ok'])),
      readings,
    })
  }

  const index: IndexBundle = {
    generatedAt: status?.generatedAt ?? new Date().toISOString(),
    ...(status ? { sources: status.sources } : {}),
    rows,
  }

  const json = `${JSON.stringify(index, null, 2)}\n`
  await fs.mkdir(path.dirname(data.index), { recursive: true })
  await fs.writeFile(data.index, json, 'utf8')

  const protocolsDir = path.join(webDir, 'protocols')
  await fs.mkdir(protocolsDir, { recursive: true })
  await fs.writeFile(path.join(webDir, 'index.json'), json, 'utf8')
  for (const record of records) {
    await fs.writeFile(
      path.join(protocolsDir, `${record.protocolId}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
      'utf8',
    )
  }
  await fs.writeFile(
    path.join(webDir, 'metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
    'utf8',
  )
  const changelog = await fs.readFile(data.changelog, 'utf8').catch(() => '[]\n')
  await fs.writeFile(path.join(webDir, 'changelog.json'), changelog, 'utf8')
  return { bundle: index, records }
}
