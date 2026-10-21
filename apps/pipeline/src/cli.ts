#!/usr/bin/env -S npx tsx
import { bundle, collect, pull, type CollectOptions } from '@defi-dna/core'

// Feed API keys (PIGI_API_KEY) live in the git-ignored .env locally and arrive
// as environment variables in CI. Variables already set are not overridden.
try {
  process.loadEnvFile()
} catch {
  /* no .env: the environment is all there is */
}

const HELP = `
defi-dna — collect what risk feeds publish about DeFi protocols.

  collect    run every adapter and write data/protocols/<id>.json
  bundle     merge those files into data/index.json and copy them to the web app
  run        collect, then bundle (default)
  pull       download the published data from the data repository instead

Flags
  --protocol <ids>   comma-separated protocol ids to limit the run
  --source <ids>     comma-separated feed or metric ids to limit the run
  --offline          never touch the network; serve from the HTTP cache
  --verbose          log every adapter step

Examples
  npm run pull
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
  // Failures grouped by adapter: what was skipped, and which cells kept their
  // previous value, each with the request that failed and why.
  for (const source of new Set(failures.map((failure) => failure.source))) {
    const own = failures.filter((failure) => failure.source === source)
    for (const skipped of own.filter((failure) => failure.protocol === null)) {
      console.log(`  skipped: ${source} — ${skipped.message}; its column keeps the previous values`)
    }
    const cells = own.filter((failure) => failure.protocol !== null)
    if (cells.length > 0) {
      console.log(
        `  failed: ${source} — ${cells.length} of ${records.length} protocols could not be read; those cells keep the previous value`,
      )
      for (const cell of cells) console.log(`    ${cell.protocol?.padEnd(14)} ${cell.message}`)
    }
  }
}

async function runBundle(): Promise<void> {
  const { bundle: index, records } = await bundle()
  const withData = index.rows.filter((row) => Object.values(row.feeds).some(Boolean)).length
  console.log(
    `bundle  ${index.rows.length} protocols, ${withData} with data from at least one feed ` +
      `(${records.length} records copied)`,
  )
}

async function runPull(): Promise<void> {
  const { source, records } = await pull()
  console.log(`pull    ${records} records from ${source}`)
  await runBundle()
}

const { command, options } = parse(process.argv.slice(2))
if (command === 'collect') await runCollect(options)
else if (command === 'bundle') await runBundle()
else if (command === 'pull') await runPull()
else if (command === 'run') {
  await runCollect(options)
  await runBundle()
} else console.log(HELP)
