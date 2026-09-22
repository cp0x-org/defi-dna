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
  "focus": "Decentralization maturity: who controls the keys and the upgrades.",
  "homepage": "https://www.defiscan.info",
  "methodologyUrl": "https://www.defiscan.info/framework",
  "enabled": true
}
```

`topic` is the two or three words printed under the feed's name in the column
header. The frontend imports this file at build time.

`id` must equal the folder name. `enabled: false` stops the feed being collected
and removes its column.

## mapping.json

Our protocol id on the left, the feed's own id on the right. Nothing else — no
flags, no notes, no coverage bookkeeping.

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
{ "aave-v3": ["aave/ethereum.md", "aave/prime.md"] }
```

## index.ts

A default-exported adapter with an `id` and a `collect()`:

```ts
import type { FeedAdapter, FeedResult } from '@defi-dna/core'
import mapping from './mapping.json' with { type: 'json' }

const table: Record<string, string> = mapping

const adapter: FeedAdapter = {
  id: 'my-feed',

  // Optional. Runs once per run; whatever it returns is passed to collect()
  // as `prepared`. Use it to fetch a listing once instead of once per protocol.
  async prepare(ctx) {
    return ctx.getJson('https://my-feed.example/api/protocols')
  },

  async collect({ protocol, ctx }): Promise<FeedResult | null> {
    const id = table[protocol.id]
    if (!id) return null // the feed has nothing for this protocol

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
[`feeds/feed-output.schema.json`](feeds/feed-output.schema.json).
The complete generated JSON, including metrics and every supported `extra` field,
is defined in [`schemas/protocol-record.schema.json`](../schemas/protocol-record.schema.json).
`extra` is structured rather than an arbitrary copy of the source response:
DeFiScan reviews; Risklayer analysis and findings; Philidor vault coverage and
vaults; DefiLlama incidents and TVL components. Each type has its own protocol
page component and appears only when that field exists in the JSON. Optional
`extra.text` is an array of source-supplied paragraphs for material that does
not fit a more specific type. New extra fields need a TypeScript type, schema
entry and frontend component.

Rules the runner applies to what you return:

| Return                                     | Stored as                            | Dashboard |
| ------------------------------------------ | ------------------------------------ | --------- |
| a result with a `value`                    | `ok`                                 | green dot |
| a result without a `value` (with a `note`) | `none`                               | grey dot  |
| `null`                                     | `none`                               | grey dot  |
| a thrown error                             | `error`, or the previous run's value | grey dot  |

Throwing is for "we could not read the source" — never for "the feed does not
cover this". Keeping those apart is what stops a broken run from looking like a
coverage gap.

`ctx` gives you `getJson`, `getText` (both cached on disk, so `--offline`
works), `log` and `now`. Adapters never call `fetch` themselves.

## Metric adapters

The same shape, returning `{ value: number | null, url?, note?, extra? }`, plus a
`metric.json` describing it (`id`, `name`, `homepage`). Metrics are measured
quantities — they appear on the protocol page and never as a feed column. See
`adapters/metrics/tvl`.

## While you work

```bash
npm run collect -- --source my-feed --protocol aave-v3 --verbose
npm test          # tests live next to the adapter, as <name>.test.ts
```
