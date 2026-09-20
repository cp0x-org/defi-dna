import fs from 'node:fs/promises'
import path from 'node:path'
import { readRecord } from './collect.ts'
import { loadRegistry, paths } from './registry.ts'
import type { IndexBundle, IndexRow, ProtocolRecord } from './types.ts'

/**
 * Merge the per-protocol files into data/index.json and copy everything the
 * frontend reads at runtime into apps/web/public/data.
 *
 * This is the only place data from different protocols meets, and all it does
 * is copy two facts per row: the TVL figure, and whether a feed has data.
 * Nothing is combined into a score, and nothing hand-maintained is copied in —
 * names and grouping stay in registry/protocols.json.
 */
export async function bundle(): Promise<{ bundle: IndexBundle; records: ProtocolRecord[] }> {
  const registry = await loadRegistry()
  const feedIds = registry.feeds.map(({ feed }) => feed.id)

  const records: ProtocolRecord[] = []
  const rows: IndexRow[] = []
  for (const protocol of registry.protocols) {
    const record = await readRecord(protocol.id)
    if (record) records.push(record)
    rows.push({
      id: protocol.id,
      tvl: record?.metrics['tvl']?.value ?? null,
      feeds: Object.fromEntries(feedIds.map((id) => [id, record?.feeds[id]?.status === 'ok'])),
    })
  }

  const index: IndexBundle = { generatedAt: new Date().toISOString(), rows }
  await write(index, records)
  return { bundle: index, records }
}

async function write(index: IndexBundle, records: ProtocolRecord[]): Promise<void> {
  const json = `${JSON.stringify(index, null, 2)}\n`
  await fs.mkdir(path.dirname(paths.index), { recursive: true })
  await fs.writeFile(paths.index, json, 'utf8')

  const protocolsDir = path.join(paths.webData, 'protocols')
  await fs.mkdir(protocolsDir, { recursive: true })
  await fs.writeFile(path.join(paths.webData, 'index.json'), json, 'utf8')
  for (const record of records) {
    await fs.writeFile(
      path.join(protocolsDir, `${record.protocolId}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
      'utf8',
    )
  }
  const changelog = await fs.readFile(paths.changelog, 'utf8').catch(() => '[]\n')
  await fs.writeFile(path.join(paths.webData, 'changelog.json'), changelog, 'utf8')
}
