# defi-dna

**defi-dna** is an open-source, neutral aggregator of DeFi risk intelligence for
Ethereum mainnet protocols. It shows what each risk feed publishes, with the
source and date, side by side. The dashboard shows coverage; it does not compute
its own score, rating or ranking. See the [project charter](CHARTER.md) for the
rules behind this approach.

The dashboard tracks protocol versions separately. Its coverage matrix has one
row per version and one column per feed. A green dot means the feed has data; a
grey dot means it does not. Opening a protocol shows each feed's value, words,
source link and assessment date. Feeds measure different things, so their
values are not merged.

## Repository layout

This is an npm workspaces monorepo. The root contains shared tooling and
documentation; the application and pipeline live in workspaces.

```text
registry/protocols.json      Protocol versions and their dashboard groups
adapters/feeds/<id>/         Risk feeds: metadata, mappings and collectors
adapters/metrics/<id>/       Independent measurements, such as TVL and incidents
packages/core/              Types, HTTP cache, collection and bundling
packages/data-client/       Runtime data reader for the frontend
apps/pipeline/              Collection and bundling CLI
apps/web/                   React and Vite dashboard
```

The registry and adapter metadata are maintained by hand and compiled into the
frontend. The pipeline writes generated snapshots to `data/` and copies them to
`apps/web/public/data/` for the local site. The site reads data at runtime from
the URL in `config.json`. The container uses [configs/config.json](configs/config.json),
which points to the separate `defi-dna-data` repository; the local frontend
defaults to `./data`. This allows data updates without rebuilding the site.

## Development

Requires [Node.js](https://nodejs.org/) 24 or newer and npm 11 or newer. The
expected Node version is in `.nvmrc`.

```bash
npm ci
npm run dev          # local dashboard at http://localhost:5173
```

`npm ci` installs all workspaces and sets up the Git hooks. The repository
includes a snapshot in `apps/web/public/data/` so the dashboard and build work
without collecting fresh data. To collect current data from the feeds, run
`npm run refresh`; this makes network requests and updates generated files.

| Command                                   | Purpose                                                        |
| ----------------------------------------- | -------------------------------------------------------------- |
| `npm run collect`                         | Collect feed and metric data into `data/protocols/*.json`      |
| `npm run bundle`                          | Build `data/index.json` and copy generated data to the web app |
| `npm run refresh`                         | Collect, then bundle                                           |
| `npm run dev`                             | Start the dashboard                                            |
| `npm run build`                           | Build the dashboard from the committed snapshot                |
| `npm run preview`                         | Preview the built dashboard                                    |
| `npm run lint` / `npm run lint:fix`       | Check or fix lint issues                                       |
| `npm run format:check` / `npm run format` | Check or apply formatting                                      |
| `npm run typecheck`                       | Type-check the pipeline, adapters and frontend                 |
| `npm test`                                | Run the adapter unit tests                                     |

The collection commands accept `--protocol`, `--source`, `--offline` and
`--verbose`. For example:

```bash
npm run collect -- --source defiscan --protocol aave-v3 --verbose
npm run collect -- --offline
```

`--offline` reads the local HTTP cache; it requires an earlier online collection
for the requested sources. The Git hook runs formatting, linting and type
checking on commits. CI also runs tests and a build.

The scheduled [refresh workflow](.github/workflows/refresh-data.yml) runs twice a
day and can also be started manually. It restores the previous snapshot before
collecting, then commits `index.json`, `changelog.json` and `protocols/*.json`
to `main` in the separate `cp0x-org/defi-dna-data` repository. To enable the
cross-repository push, add a `DEFI_DNA_DATA_TOKEN` Actions secret to this
repository. It must grant Contents read and write access to `defi-dna-data`.

## Docker

```bash
docker compose up --build    # http://127.0.0.1:8080
```

The image serves the static app. Docker Compose mounts
`configs/config.json`, which chooses where the app reads generated data. To
serve from a repository subpath, set `DEFI_DNA_BASE=/defi-dna/` for the build.

By default, port 8080 is bound to the host's loopback address. If a reverse
proxy runs in another Docker container and connects through
`host.docker.internal:8080`, set `DEFI_DNA_BIND_IP` to the host's Docker bridge
address in the project's `.env` file (copy `.env.example`; for example,
`DEFI_DNA_BIND_IP=172.17.0.1`), then recreate the app with
`docker compose up -d --build`. The bridge address must match where
`host.docker.internal` resolves inside the proxy container.

## Sources and contributions

Risk feeds currently include [DeFiScan](https://www.defiscan.info),
[Risklayer](https://risklayer.online) and
[Philidor](https://analytics.philidor.io). Independent measurements come from
DefiLlama's Ethereum TVL and incident history. A feed with no data for a
protocol is distinct from a collection error; a failed refresh retains the
previous value.

To add a feed, copy `adapters/feeds/_template/`, provide its metadata and
protocol mapping, then implement `collect()` in `index.ts`. See the
[adapter guide](adapters/README.md) and
[output schema](adapters/feeds/feed-output.schema.json).

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), the
[Code of Conduct](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md).

## License

Licensed under [AGPL-3.0-only](LICENSE). Assessments quoted from third-party
feeds remain their providers' content and retain attribution and source links.
