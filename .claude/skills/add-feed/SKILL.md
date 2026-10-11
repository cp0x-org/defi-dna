---
name: add-feed
description: Add or update a risk feed adapter in adapters/feeds/<id> (feed.json, mapping.json, index.ts, fixtures, test) following the project charter. Use when asked to integrate a new feed, write or fix a feed adapter, map protocols to a feed's ids, or add a metric adapter.
---

# Add a feed adapter

One folder is one feed. The folder name is the id. Nothing else registers it.
Rules that override everything below: `CHARTER.md` and the "Non-negotiables"
section of `AGENTS.md`.

## 0. Feed card first (5 minutes, saves hours)

Write these answers into the task or the PR description before touching code.
If an answer is unknown, find it in the provider's docs; do not guess.

| Question                                                                                            | Why it matters                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What object does the feed assess: protocol, deployment, vault, pool, asset, or a research document? | Goes into `feed.json` as `assesses` and is printed next to every value. Decides how `mapping.json` is keyed and what the `note` must say. A vault score never stands in for the protocol. |
| What exactly does it publish: scale, bands, units, as written on its methodology page (URL)?        | `value` is carried verbatim; the methodology URL goes in `feed.json`. If the page says how values read (own colour band, risk level, described bands), declare `status`; otherwise none.  |
| Access: documented API, public repository, or manual curation? Key? Rate limit / monthly quota?     | Source hierarchy: API → repository → manual. Undocumented SPA endpoints need the provider's written permission. No scraping of verdicts.                                                  |
| Can it be filtered to Ethereum mainnet?                                                             | We store Ethereum only.                                                                                                                                                                   |
| Its identifiers for our protocols (`registry/protocols.json`)?                                      | This is `mapping.json`.                                                                                                                                                                   |
| How often does the feed update, and does it publish its own date per entry?                         | `updatedAt` must be the feed's date, never our fetch time. TTL for `ctx.getJson`.                                                                                                         |

## 1. Scaffold

```bash
cp -R adapters/feeds/_template adapters/feeds/<id>
```

- `feed.json`: `id` = folder name, `name`, `topic` (two or three words for the
  column header), `focus` (one line in the feed's own terms), `assesses` (one of
  `protocol`, `deployment`, `vault`, `pool`, `asset`, `research`), `homepage`,
  `methodologyUrl`, `enabled: true`.
- `index.ts`: `id: '<id>'`. The registry refuses a mismatch.

## 2. `mapping.json`

Our protocol id → the feed's own id(s). The template lists every protocol
version from `registry/protocols.json` with an empty value and a comment line
saying what it is (name, category, website, scope), so the spelling is never
guessed: put the feed's id in the value for each protocol it covers and delete
the lines for the rest. A string, or a list of strings when the feed files
several things under one of our rows.

```json
{ "aave-v3": ["aave/ethereum.md", "aave/prime.md"], "curve": "curve.fi" }
```

An empty value is refused by the pipeline once the feed is enabled and by
`npm test`, naming the file and the key. The file reaches the adapter as
`ctx.mapping`, with every value as a list. Protocols the feed cannot be mapped
to unambiguously go into the pull request as questions, never as guesses.

## 3. `index.ts`

Current core API (`packages/core/src/types.ts`):

```ts
import type { Detail, FeedAdapter, FeedResult } from '@defi-dna/core'

// The type parameter is what prepare() returns; collect() receives it typed.
const adapter: FeedAdapter<Map<string, Entry[]>> = {
  id: '<id>',
  secrets: ['<ID>_API_KEY'],                        // only if the source needs a key
  async prepare(ctx) {
    // optional: one listing per run, with ttlSeconds. Object.values(ctx.mapping).flat()
    // gives every source id the mapping names. If this throws, collect() is not
    // called and the column keeps the previous run's values.
  },
  async collect({ protocol, ctx, prepared }): Promise<FeedResult | null> {
    const mapped = ctx.mapping[protocol.id] ?? []
    if (mapped.length === 0) return null           // not covered → grey cell
    // listed but no published value → { url, note } without value → also grey, with the reason
    // could not read the source → throw            → error, previous value kept
    return { value, summary?, details?, updatedAt?, url, note?, extra? }
  },
}
export default adapter
```

Rules for the returned object:

- `value`: the headline exactly as published, as a string. No rounding, no
  conversion, no label of ours. Several things under one row → join with
  `·` and say so in `note`.
- `summary`: the feed's own text, quoted, trimmed to ~700 chars. Never our prose.
- `details`: the feed's own breakdown (dimensions, top vaults by TVL, capped at
  ~10). `description` is optional and rendered behind a dropdown.
- `updatedAt`: the feed's date (ISO). Treat sentinels like `1970-01-01` as absent.
- `url`: the feed's page for this protocol, where a reader checks the value.
- `note`: what the data covers and what was left out (counts, versions, shut-down
  vaults). Facts about coverage, never a judgement.
- `extra`: only the shapes in `ExtraData` (`types.ts`) and
  `schemas/protocol-record.schema.json`: `facts` (name/value pairs about the
  record), `reviews`, `findings`, `vaults`, `incidents`, `components`, `text`.
  Pick from these; a new feed needs no frontend work. Cap arrays (100 vaults).
  If nothing fits, use `extra.text`; only a genuinely new shape needs a type,
  a schema entry and a component in `apps/web/src/components/extra/`.
- Network only through `ctx`. Declare a key in `secrets`, read it from
  `process.env.<NAME>` inside `prepare()`, and pass tokens via the `headers`
  function of `getJson` so a cached or `--offline` read never needs it. An
  online run without the key skips the feed with one line. See
  `adapters/feeds/pigi/index.ts`.
- The protocol page renders `extra` through its components only. There is no
  raw-record view and none may be added: the stored JSON is public in git. A
  new shape stays invisible until it has a component.

Metric adapters (`adapters/metrics/<id>/`): same shape, `metric.json` instead of
`feed.json`, `collect()` returns `{ value: number | null, url?, note?, extra? }`.

## 4. Run it

```bash
npm run collect -- --source <id> --protocol aave-v3 --verbose
npm run collect -- --source <id> --verbose          # every protocol
npm run collect -- --source <id> --offline          # must work from the cache
```

Read the console flags (`#` ok, `.` none, `!` error) and the generated
`data/protocols/<protocol>.json`. Check: `status` is `ok` only where there is a
real value; `note` explains every `none`; `url` opens the right page; `updatedAt`
is the feed's date; the record stays small. The runner validates every result against the
schema before storing it; a rejected result shows as `!` and a `failed:` line
naming the field.

## 5. Test on real responses

- Copy the `body` of the matching `.cache/http/<sha>.json` files into
  `adapters/feeds/<id>/fixtures/*.json`, trimmed to a few entries. Keep the
  values real; do not invent ratings or dates.
- `adapters/feeds/<id>/index.test.ts` (vitest) runs the adapter itself through
  `fakeContext` from `@defi-dna/core/testing`: a map of URL → body (`POST <url>`
  for `postJson`, `null` for a 404), plus the mapping the test needs. Call
  `adapter.prepare!(ctx)` once, then `adapter.collect({ protocol, ctx, prepared })`
  for three cases: covered (`value`, `details` order, `updatedAt`, `url`,
  `extra`); listed but without a value (`note`, no `value`); not mapped
  (`null`). `ctx.requests` shows what was fetched. A key exchange runs too:
  `vi.stubEnv('<ID>_API_KEY', 'test')` and serve `POST <token url>`.
- `adapters/feeds/_template/index.test.ts` is the example to copy. Run `npm test`.

## 6. Documentation and secrets

- README, "Sources and contributions": add the feed and, if a key is needed,
  the env variable.
- The interface names no feed in its prose; what it shows comes from
  `feed.json`. To pause a feed, set `enabled: false` (its cells are kept); to
  retire it, delete the folder.
- `.env.example`: the variable with a comment and where to get the key.
- `.github/workflows/refresh-data.yml`: pass the secret to `npm run refresh`.
- `adapters/README.md` only if the workflow itself changed.

## 7. Verify and open the PR

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
npm run dev   # open /#/protocol/<id> and /#/sources, check the card and the column
```

PR description: the feed card from step 0, sample output for one protocol,
and a line confirming no arithmetic across feeds and no scale mapping.
Use the pull request template.
