# Feed template

Copy this folder, rename it to your feed's id, and edit the three files. The
folder name is the id — nothing else has to be registered anywhere.

```bash
cp -R adapters/feeds/_template adapters/feeds/my-feed
npm run collect -- --source my-feed --verbose
```

Folders starting with `_` are templates: the pipeline and the frontend skip them.

| File           | What it is                                                   |
| -------------- | ------------------------------------------------------------ |
| `feed.json`    | what the feed is — shown on the site, imported at build time |
| `mapping.json` | our protocol id → the feed's own id. Nothing else            |
| `index.ts`     | how to read the feed: one `collect()` per protocol           |

What `collect()` returns is described by
[`../feed-output.schema.json`](../feed-output.schema.json) — the same shape for
every feed, so the site can render a feed it has never seen.
