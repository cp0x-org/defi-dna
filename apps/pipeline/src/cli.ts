#!/usr/bin/env -S npx tsx
import { bundle, collect, type CollectOptions } from '@defi-dna/core'

const HELP = `
defi-dna — collect what risk feeds publish about DeFi protocols.

  collect    run every adapter and write data/protocols/<id>.json
  bundle     merge those files into data/index.json and copy them to the web app
  run        collect, then bundle (default)

Flags
  --protocol <ids>   comma-separated protocol ids to limit the run
  --source <ids>     comma-separated feed or metric ids to limit the run
  --offline          never touch the network; serve from the HTTP cache
  --verbose          log every adapter step

Examples
  npm run refresh
  npm run collect -- --source defiscan --protocol aave-v3 --verbose
  npm run collect -- --offline
`

function parse(argv: string[]): { command: string; options: CollectOptions } {
  let command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'run'
  const options: CollectOptions = {}
  for (let i = command === argv[0] ? 1 : 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = () => (argv[++i] ?? '').split(',').filter(Boolean)
    if (flag === '--protocol') options.protocols = value()
    else if (flag === '--source') options.sources = value()
    else if (flag === '--offline') options.offline = true
    else if (flag === '--verbose') options.verbose = true
    else if (flag === '--help' || flag === '-h') command = 'help'
    else if (flag?.startsWith('--')) throw new Error(`unknown flag ${flag}`)
  }
  return { command, options }
}

async function runCollect(options: CollectOptions): Promise<void> {
  console.log(`collect${options.offline ? ' (offline)' : ''}`)
  const { records, changes, failures } = await collect(options)
  console.log(`\n  ${records.length} protocols written, ${changes.length} value(s) changed`)
  for (const failure of failures) console.log(`  failed: ${failure}`)
}

async function runBundle(): Promise<void> {
  const { bundle: index, records } = await bundle()
  const withData = index.rows.filter((row) => Object.values(row.feeds).some(Boolean)).length
  console.log(
    `bundle  ${index.rows.length} protocols, ${withData} with data from at least one feed ` +
      `(${records.length} records copied)`,
  )
}

const { command, options } = parse(process.argv.slice(2))
if (command === 'collect') await runCollect(options)
else if (command === 'bundle') await runBundle()
else if (command === 'run') {
  await runCollect(options)
  await runBundle()
} else console.log(HELP)
