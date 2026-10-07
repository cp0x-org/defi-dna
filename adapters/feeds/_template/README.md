# Feed template

Copy this folder, rename it to the feed's id, and fill in the files below. The
folder name is the id; nothing else has to be registered anywhere: the pipeline
reads the folders under `adapters/feeds/`, and the site picks up `feed.json`.

```bash
cp -R adapters/feeds/_template adapters/feeds/my-feed
```

Folders starting with `_` are templates: the pipeline, the site and the tests
skip them. The rules every adapter works under are in
[`../../README.md`](../../README.md); this page is the walkthrough.

## 0. The feed card — answer before writing code

| Question                                                                                                                 | Where the answer goes                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| What does the feed assess: the protocol, each deployment, individual vaults, pools, assets, or research without a scale? | `assesses` in `feed.json`; it is printed next to every value. A vault score never stands in for the protocol.                        |
| What exactly does it publish — scale, bands, units — as written on its methodology page?                                 | `value` is carried verbatim; the page goes in `methodologyUrl`.                                                                      |
| Documented API, public repository, or manual curation? Key? Rate limit or monthly quota?                                 | `API`, `TTL` and `secrets` in `index.ts`. No scraping of verdicts; an undocumented endpoint needs the provider's written permission. |
| Can it be filtered to Ethereum mainnet?                                                                                  | The pipeline stores Ethereum only.                                                                                                   |
| What are its identifiers for our protocols?                                                                              | `mapping.json`.                                                                                                                      |
| How often does it update, and does it publish a date per entry?                                                          | `TTL`, and `updatedAt` — always the feed's date, never our fetch time.                                                               |

Write the answers into the pull request; they are the review.

## 1. The files

| File            | What it is                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `feed.json`     | what the feed is and what it assesses — shown on the site, imported at build time                 |
| `mapping.json`  | our protocol id → the feed's own id(s). Every protocol is pre-listed; fill in or delete each line |
| `index.ts`      | how to read the feed: `prepare()` once per run, `collect()` once per protocol                     |
| `index.test.ts` | the adapter run over `fixtures/`, through `fakeContext`                                           |
| `fixtures/`     | real responses, trimmed to a few entries — copied from `.cache/http/` after one online run        |

## 2. `feed.json`

| Field            | Required | What to put there                                                                                              |
| ---------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `id`             | yes      | the folder name, exactly                                                                                       |
| `name`           | yes      | the feed's name as it writes it: "DeFiScan", "pigi.finance"                                                    |
| `topic`          | yes      | two or three words under the name in the column header: "Decentralization", "Vault risk"                       |
| `focus`          | yes      | one line on what the feed looks at, in its own terms; shown on the feeds page and in the card's help           |
| `assesses`       | yes      | `protocol`, `deployment`, `vault`, `pool`, `asset` or `research`                                               |
| `homepage`       | yes      | the feed's site                                                                                                |
| `methodologyUrl` | no       | where the feed explains its scale; linked from the feeds page                                                  |
| `enabled`        | yes      | `true` to collect and show the feed. `false` hides it and stops collecting, but keeps the cells already stored |

## 3. `mapping.json`

Our protocol id on the left, the feed's own id on the right, nothing else. The
template lists every protocol version from `registry/protocols.json` with an
empty value and a comment line saying what it is: put the feed's id in the
value for each protocol the feed covers and delete the lines for the rest. An
empty value is refused once the feed is enabled, and by `npm test`, so no
protocol is forgotten by accident.

```json
{
  "aave-v3": ["aave/ethereum.md", "aave/prime.md"],
  "curve": "curve.fi"
}
```

- Our ids are protocol _versions_ (`aave-v3`, `aave-v4`), because feeds file
  versions separately. Map each version to what the feed files under it; never
  let a v3 assessment fill the v4 row.
- A value may be a list when the feed files several things under one of our
  rows. The adapter then reads them all and shows every value.
- The pipeline reads this file, checks every key against the registry and hands
  it to the adapter as `ctx.mapping`, with every value as a list.
- Keys starting with `_` are comments.

## 4. `index.ts`

`prepare(ctx)` runs once per run: fetch a listing there, not once per
protocol. `collect({ protocol, ctx, prepared })` runs per protocol and gives
one of three answers:

| Return                                     | Stored as                                        | Dashboard                 |
| ------------------------------------------ | ------------------------------------------------ | ------------------------- |
| a result with a `value`                    | `ok`                                             | green dot                 |
| a result with a `note` and no `value`      | `none`                                           | grey dot, with the reason |
| `null`                                     | `none`                                           | grey dot                  |
| a thrown error                             | `error`, or the previous run's value             | unchanged                 |
| `prepare()` throws, or a secret is missing | the whole column keeps its values; reported once | unchanged                 |
| a result the schema rejects                | `error`, or the previous run's value             | unchanged                 |

Throwing is for "we could not read the source", never for "the feed does not
cover this". Keeping those apart is what stops a broken run from looking like
a coverage gap.

What a result holds (`../feed-output.schema.json` has every field):

| Field       | What it is                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`     | the headline, verbatim, as a string: "Stage 1", "4.8/10 · medium", "7 vaults rated". No rounding, conversion or label of ours                                                     |
| `summary`   | the feed's own text about the protocol, quoted and trimmed to ~700 characters. Never our prose                                                                                    |
| `details`   | the feed's own breakdown — dimensions, sub-scores, top vaults — about ten entries; `description` sits behind a dropdown                                                           |
| `updatedAt` | the feed's date for this assessment (ISO). Sentinels like `1970-01-01` are not dates                                                                                              |
| `url`       | the feed's page for this protocol. Required with a value                                                                                                                          |
| `note`      | what the data covers and what was left out: counts, versions, shut-down vaults. A fact, never a judgement                                                                         |
| `extra`     | structured data in the shapes the site renders: `facts`, `reviews`, `findings`, `vaults`, `incidents`, `components`, `text`. Cap lists (100 vaults); use `text` when nothing fits |

`ctx` is everything the adapter may touch:

| Member                  | What it does                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `mapping`               | this folder's `mapping.json`, every value a list                                                      |
| `getJson(url, options)` | GET and parse; cached on disk for `ttlSeconds`, replayed by `--offline`                               |
| `getText(url, options)` | the same for text; `rangeBytes` reads the head of a large file, `allowNotFound` turns a 404 into `''` |
| `postJson(url, body)`   | POST; never cached, never retried — for trading a key for a token                                     |
| `log(message)`          | printed with `--verbose`                                                                              |
| `now`                   | the run's time                                                                                        |

Adapters never call `fetch` themselves. A feed behind a key declares it in
`secrets`, reads it from `process.env` inside `prepare()`, and passes the token
through the `headers` function of `getJson`, which runs only when a request
really goes to the network. `adapters/feeds/pigi/index.ts` is the worked example.

## 5. Run it

```bash
npm run collect -- --source my-feed --protocol aave-v3 --verbose   # one protocol
npm run collect -- --source my-feed --verbose                      # every protocol
npm run collect -- --source my-feed --offline                      # replay from .cache/http
```

Each line prints one mark per feed column: `#` data, `.` none, `!` error. Read
`data/protocols/<protocol>.json` afterwards: `status` is `ok` only where there
is a real value, every `none` has a `note` saying why, `url` opens the feed's
page, `updatedAt` is the feed's date. The runner validates every result against
the schema; a rejected result shows as `!` with a `failed:` line naming the field.

## 6. Test it

Copy the `body` of the matching `.cache/http/<sha>.json` files into `fixtures/`,
trimmed to a few entries. `index.test.ts` runs the adapter over them through
`fakeContext` and covers the three answers: covered, listed without a value,
not mapped. `npm test`.

## 7. Before the pull request

- `README.md`, "Sources and contributions": add the feed; name the environment
  variable if it needs a key.
- `.env.example`: the variable, with a comment on where to get the key.
- `.github/workflows/refresh-data.yml`: pass the secret to `npm run refresh`.
- `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
- `npm run dev`, then open the protocol page and the feeds page: the card and
  the column render, and the raw record behind the card shows what you stored.
- The pull request carries the feed card from step 0 and one sample record.

## Rules that do not bend

From [`CHARTER.md`](../../../CHARTER.md): no arithmetic across feeds, no score
or ranking of ours; values verbatim, with the feed's URL and date; `none` is
not `error`; a failed refresh keeps the previous value; our words describe
scope and provenance and never restate what a feed concluded.
