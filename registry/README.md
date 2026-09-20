# `registry/` — hand-maintained

The half of the data people write. It is compiled into the frontend at build
time, while everything generated is fetched at runtime from [`data/`](../data).

| File             | What it is                                                          |
| ---------------- | ------------------------------------------------------------------- |
| `protocols.json` | the protocol versions we track, and how they group on the dashboard |

A protocol version is a row: sources file Aave v3 and Aave v4 separately, so we
collect them separately. `group` only nests rows for reading — no value is ever
carried from one version to another.

```json
{ "id": "aave-v4", "name": "Aave v4", "group": "Aave", "category": "lending" }
```

Feed and metric descriptions are hand-maintained too, but they live next to the
adapter that reads them: `adapters/feeds/<id>/feed.json` and
`adapters/metrics/<id>/metric.json`.
