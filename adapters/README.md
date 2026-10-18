# Adapters

One folder is one source. The folder name is its id — nothing else has to be
registered anywhere.

```
adapters/
  feeds/_template/            copy this to start a new feed
  feeds/feed-output.schema.json   the shape every feed produces
  ../schemas/protocol-record.schema.json   the generated JSON and all extra types
  feeds/<id>/      feed.json + mapping.json + index.ts     one dashboard column
  metrics/<id>/    metric.json + mapping.json + index.ts   a measured quantity
```

Start from the template:

```bash
cp -R adapters/feeds/_template adapters/feeds/my-feed
npm run collect -- --source my-feed --verbose
```

Folders starting with `_` are templates — the pipeline and the frontend skip them.

## feed.json

What the feed is. Shown on the Feeds page, nothing more.

```json
{
  "id": "defiscan",
  "name": "DeFiScan",
  "topic": "Decentralization",
  "focus": "On-chain admin rights and dependencies: who can change contracts and how much capital those powers reach.",
  "assesses": "deployment",
  "homepage": "https://www.defiscan.info",
  "methodologyUrl": "https://docs.defiscan.info/researchers/methodology",
  "enabled": true
}
```

`topic` is the two or three words printed under the feed's name in the column
header. `assesses` names the object the feed's values are about — `protocol`,
`deployment`, `vault`, `vault-protocol`, `pool`, `asset` or `research` — and is printed next to
every value, so a vault tier is never read as a verdict on the protocol. The
frontend imports this file at build time.

`id` must equal the folder name. `enabled: false` stops the feed being collected
and removes its column; the cells already stored are kept, so switching the feed
back on resumes from its last read. To retire a feed, delete its folder: its
cells are dropped from the records on the next run (the git history keeps them).

## mapping.json

Our protocol id on the left, the feed's own id on the right. Nothing else — no
flags, no notes, no coverage bookkeeping. The template's `mapping.json` lists
every protocol in the registry with an empty value and a comment saying what
it is: fill in the ones the feed covers and delete the rest, so you never guess
how an id is spelled.

```json
{
  "aave-v3": "aave.com",
  "curve": "curve.fi"
}
```

Our ids are protocol _versions_ (`aave-v3`, `aave-v4`, `uniswap-v2`), because
sources file them separately — see [`registry/protocols.json`](../registry).
A protocol the feed does not cover is simply left out: the adapter returns
`null`, the cell stays grey, and nothing breaks. Where a feed files several
things under one of our rows, the value may be a list:

```json
{ "aave-v3": ["aave-v3", "aave-v3-prime"] }
```

The pipeline reads this file itself and hands it to the adapter as
`ctx.mapping`, with every value as a list. Every key is checked against the
registry when the pipeline starts (and by `npm test`): a typo fails loudly
instead of being stored as "the feed has no data for this protocol".

## index.ts

A default-exported adapter with an `id` and a `collect()`:

```ts
import type { FeedAdapter, FeedResult } from '@defi-dna/core'

// The type parameter is what prepare() returns; collect() receives it typed.
const adapter: FeedAdapter<Set<string>> = {
  id: 'my-feed',

  // Environment variables the feed needs, if any. A missing one skips the feed
  // for the run (the column keeps its previous values) and is reported once.
  secrets: ['MY_FEED_API_KEY'],

  // Optional. Runs once per run; whatever it returns is passed to collect()
  // as `prepared`. Use it to fetch a listing once instead of once per protocol.
  // If it throws, collect() is not called and the column keeps its values.
  async prepare(ctx) {
    const listed = await ctx.getJson<{ id: string }[]>('https://my-feed.example/api/protocols')
    return new Set(listed.map((entry) => entry.id))
  },

  async collect({ protocol, ctx, prepared }): Promise<FeedResult | null> {
    const [id] = ctx.mapping[protocol.id] ?? []
    if (!id) return null // the feed has nothing for this protocol
    if (!prepared.has(id)) return { note: `The feed lists nothing for ${protocol.name}.` }

    const data = await ctx.getJson<{ rating: string; updated: string }>(
      `https://my-feed.example/api/${id}`,
    )
    return {
      value: data.rating, // verbatim, as the feed publishes it
      updatedAt: data.updated, // when the feed last updated it, not our fetch time
      url: `https://my-feed.example/${id}`, // where a reader can check it
    }
  },
}

export default adapter
```

The full shape, with every field described, is
[`feeds/feed-output.schema.json`](feeds/feed-output.schema.json). The runner
checks every result against it before storing it, so a `value` that is not a
string, an `ok` without a `url` or an unknown key in `extra` is reported as a
failed read rather than published.
The complete generated JSON, including metrics and every supported `extra` field,
is defined in [`schemas/protocol-record.schema.json`](../schemas/protocol-record.schema.json).
`extra` is structured rather than an arbitrary copy of the source response, and
its fields are _shapes_, not feed names: `facts` (name/value pairs about the
record: "Vaults listed: 197", "Risk level: medium"), `reviews` (one per
deployment the source files separately), `findings` (with the source's own
severity and category), `vaults` (a table), `incidents`, `components` (what a
TVL figure sums) and `text` (source-supplied paragraphs). Each shape has one
protocol page component and appears only when the field exists in the JSON, so
a new feed picks from the list and needs no frontend work. Only a genuinely new
shape needs a TypeScript type, a schema entry and a component.

Rules the runner applies to what you return:

| Return                                     | Stored as                                        | Dashboard |
| ------------------------------------------ | ------------------------------------------------ | --------- |
| a result with a `value`                    | `ok`                                             | green dot |
| a result without a `value` (with a `note`) | `none`                                           | grey dot  |
| `null`                                     | `none`                                           | grey dot  |
| a thrown error                             | `error`, or the previous run's value             | grey dot  |
| `prepare()` throws, or a secret is missing | the whole column keeps its values; reported once | unchanged |
| a result the schema rejects                | `error`, or the previous run's value             | grey dot  |

Throwing is for "we could not read the source" — never for "the feed does not
cover this". Keeping those apart is what stops a broken run from looking like a
coverage gap.

`ctx` gives you `mapping` (this folder's `mapping.json`, normalized),
`getJson`, `getText` (both cached on disk, so `--offline` works), `postJson`
(cached only with a `ttlSeconds`, for an API that answers queries to POST
alone), `log` and `now`. Adapters never call `fetch` themselves.

A feed behind an API key declares it in `secrets`, reads it from the
environment (`.env` locally, an Actions secret in the refresh workflow) and
trades it for a token through `postJson`. Pass the token as a `headers`
function to `getJson`: it runs only when the request really goes to the
network, so a cached or `--offline` read needs no key. See
`adapters/feeds/pigi`. A GraphQL API that takes the key as a header goes
through `postJson` with `ttlSeconds` and the same `headers` function: the
response is cached by URL and body. See `adapters/feeds/credora`.

## Metric adapters

The same shape, returning `{ value: number | null, url?, note?, extra? }`, plus a
`metric.json` describing it (`id`, `name`, `homepage`). Metrics are measured
quantities — they appear on the protocol page and never as a feed column. See
`adapters/metrics/tvl`, and `adapters/metrics/governance` for a source read
over JSON-RPC: batched `eth_call`s go through `postJson` with `ttlSeconds`, so
they are cached by body and replay offline.

## While you work

```bash
npm run collect -- --source my-feed --protocol aave-v3 --verbose
npm run collect -- --source my-feed --offline      # replay from .cache/http
npm test
```

Tests live next to the adapter as `index.test.ts` and run the adapter itself
over canned responses, through `fakeContext` from `@defi-dna/core/testing`:

```ts
import { fakeContext } from '@defi-dna/core/testing'
import listing from './fixtures/listing.json' with { type: 'json' }
import adapter from './index.ts'

const ctx = fakeContext({ 'https://my-feed.example/api/protocols': listing }, { mapping })
const prepared = await adapter.prepare!(ctx)
const result = await adapter.collect({ protocol, ctx, prepared })
```

A fixture is a real response, trimmed to a few entries: copy the `body` of the
matching `.cache/http/<sha>.json` into `fixtures/`. An unknown URL throws, a
`null` body is a 404, `POST <url>` keys serve `postJson`, and a request's
`headers` function runs as it would on the network, so a key exchange is
exercised too. Cover the three answers a feed gives: covered, listed but
without a value (a `note`, no `value`), and not mapped (`null`). The template
folder has a complete example.
