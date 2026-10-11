# AGENTS.md — working in defi-dna

Read this before changing anything. It is short on purpose; the details live in
the files it points to.

## What this project is

A neutral aggregator of DeFi risk feeds for Ethereum mainnet. It shows what each
feed publishes about each protocol version, verbatim, side by side, with the
source URL and the feed's own date. It never computes a score of its own.
`CHARTER.md` is binding; its section 1 cannot be relaxed without written
agreement from the Ethereum Foundation.

## Non-negotiables

- No arithmetic across feeds. No composite score, average, ranking, "reconciled"
  column, or default sort order that reads as a risk ranking. Counting feeds by
  status (the dashboard's Signals column) is a number computed from several
  feeds' values: it needs the Ethereum Foundation's written agreement under
  CHARTER §1 before it ships.
- A feed's value is stored as the feed published it, as a string, with `url`
  and the feed's `updatedAt`. Never convert one feed's scale into another's.
- Colour a value only by the feed's own characterization. Where the feed's
  methodology says how its values read — its own colour band, a risk-level word,
  bands it describes — `feed.json` declares that reading in `status` and the page
  prints its `rule` next to the colour. Where it does not — a count, a vault
  list, a figure with no stated direction — the value is neutral. No data is
  grey. Never set a threshold or a cut of our own.
- `none` (the feed has nothing for this protocol) and `error` (we could not read
  the feed) are different states. An adapter returns `null` for the first and
  throws for the second. A failed refresh keeps the previous value.
- Our prose describes scope and provenance. It never restates or summarises what
  a feed concluded.

## Layout

```
registry/protocols.json        protocol versions (rows), hand-maintained
adapters/feeds/<id>/           feed.json + mapping.json + index.ts  → one column
adapters/feeds/_template/      copy this to start a feed
adapters/metrics/<id>/         metric.json (+ mapping.json) + index.ts → TVL, incidents
packages/core/src/             types, HTTP cache, registry loader, collect, bundle, pull
packages/data-client/src/      runtime JSON reader for the frontend (@defi-dna/data)
apps/pipeline/src/cli.ts       collect | bundle | run | pull
apps/web/src/                  React + Vite dashboard (hash router)
schemas/                       JSON Schema of the generated record (documentation)
data/, apps/web/public/data/   generated, git-ignored; published to cp0x-org/defi-dna-data
docs/refactoring-report.md     current refactoring plan and database analysis
```

The folder name is the adapter id. Nothing registers feeds anywhere else: the
pipeline reads the folders, the frontend globs `feed.json`.

## Commands

```bash
npm ci                       # install all workspaces + git hooks (Node 24, npm 11)
npm run pull                 # download the published data into data/
npm run collect -- --source <id> --protocol <id> --verbose   # one adapter, one protocol
npm run collect -- --offline # replay from .cache/http
npm run refresh              # collect, then bundle
npm run dev                  # dashboard on :5173
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

CI runs the last line. The pre-commit hook runs lint-staged and typecheck.
`PIGI_API_KEY` lives in `.env` locally (see `.env.example`) and in Actions secrets.

## Conventions

- TypeScript strict, ESM, `.ts` extensions in relative imports,
  `import x from './x.json' with { type: 'json' }` for JSON.
- Adapters never call `fetch`. Use `ctx.getJson` / `ctx.getText` (cached on
  disk) and `ctx.postJson` (never cached, for credentials only).
- `prepare(ctx)` runs once per run: fetch a listing there, not per protocol.
  `collect({ protocol, ctx, prepared })` runs per protocol, with `prepared`
  typed by the adapter's type parameter (`FeedAdapter<Map<…>>`). If
  `prepare()` throws, the column keeps the previous values and the run reports
  it once.
- `mapping.json` reaches the adapter as `ctx.mapping` (every value a list);
  its keys are checked against the registry by the pipeline and by `npm test`.
- A feed that needs a key declares it in `secrets` and reads it inside
  `prepare()`; `feed.json` declares `assesses` (protocol, deployment, vault,
  pool, asset, research).
- `status` in `feed.json`, only when the methodology states the reading: `rule`
  (one sentence that quotes or cites it), `match` (a regular expression over the
  headline `value`; its first group is the feed's own word or band) and `values`
  (that word, lower-case → `positive`, `neutral` or `negative`). Anything that
  does not match stays neutral. `apps/web/src/lib/status.test.ts` checks every
  rule; add the feed's real headlines to it.
- Shape of what `collect()` returns: `adapters/feeds/feed-output.schema.json`.
  The runner validates every result against the schema before storing it.
  `extra` holds only the shapes in `ExtraData` (`packages/core/src/types.ts`):
  `facts`, `reviews`, `findings`, `vaults`, `incidents`, `components`, `text`.
  Pick from them; only a genuinely new shape needs a type, a schema entry and
  a component. When nothing fits, use `extra.text`.
- Cap lists you put into `extra` (100 vaults is the current cap); a protocol
  record should stay well under ~200 KB. A new `extra` shape is not visible
  on the page until it has a component.
- Tests sit next to the code as `*.test.ts` / `*.test.tsx` (vitest, node
  environment, `renderToStaticMarkup` for components). An adapter test runs the
  adapter through `fakeContext` (`@defi-dna/core/testing`) over `fixtures/`
  trimmed from real responses in `.cache/http`; the template folder has the
  example.
- Generated data: `data/protocols/<id>.json` changes only when a feed's
  content changes (cells carry `since`); `data/metrics.json` and
  `data/status.json` are rewritten every run.
- `enabled: false` in feed.json hides a feed and stops collecting it but
  keeps its stored cells; deleting the folder drops them.
- Core tests (`packages/core/src/*.test.ts`) run the real collector over a
  fake registry in a temporary directory: `collect({ dataDir, registry })`,
  `new Http({ cacheDir, fetch, retries })`. Use them, not the repository's
  `data/`, for anything that writes.
- Comments explain why, not what. Keep the existing tone of the docs.
- Documentation to update when a feed is added: README "Sources and
  contributions", `.env.example` and `refresh-data.yml` if a key is needed,
  and the prose in `apps/web/src/pages/MethodologyPage.tsx` if it names feeds.

## Do not

- Do not commit `grant_data/`, `data/`, `apps/web/public/data/` or `.cache/`.
  `grant_data/` holds private material and must stay out of this public repo.
- Do not add dependencies, base classes, or generic helpers for a single use.
  No Zod, no ORM, no database, no Playwright scraping of verdicts.
- Do not read undocumented endpoints of a provider's SPA without the provider's
  written permission; prefer documented APIs, public repositories, then manual
  curation with a date and a link.
- Do not change `CHARTER.md` section 1.
- Do not show raw data in the interface: no "Raw record" dropdown, no `<pre>`
  or `JSON.stringify` dump of a record, a cell or `extra`. The stored JSON is
  public in git (`cp0x-org/defi-dna-data`, charter §2); the page renders it
  through components only.

## For AI agents specifically

- Before editing an adapter, run it once (`--source <id> --verbose`) and read the
  generated `data/protocols/<protocol>.json`.
- Finish with the full CI command line above. Report test output verbatim.
- The team writes internal notes in Russian; code, comments and repo docs are
  in English.
