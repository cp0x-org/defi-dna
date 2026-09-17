# defi DNA

**defi DNA** is a neutral, open-source aggregator of DeFi risk intelligence: it
shows what every major risk feed says about an Ethereum mainnet protocol —
verbatim, side by side, with sources and dates. It publishes **no composite
score and no ratings of its own**; the aggregation itself is the value, and
coverage gaps are shown as data rather than hidden. The project is licensed
under AGPL-3.0 and developed in the open from day one.

## Repository layout

The repository is an npm workspaces monorepo. Nothing application-specific lives
at the root — the root holds shared tooling, configuration and documentation
only.

```text
.
├── web/        # @defi-dna/web — frontend (Vite + TypeScript)
└── …           # shared tooling: ESLint, Prettier, Husky, CI
```

Further workspaces (data pipeline, adapters, on-chain collectors) are added as
sibling directories and registered in the root `workspaces` field.

## Development

### Requirements

- [Node.js](https://nodejs.org/) `>=24.0.0` (see `.nvmrc`)
- npm `>=11` (ships with Node.js 24)

### Installation

```bash
git clone <repository-url>
cd <repository-directory>
npm install
```

Run `npm install` once at the root: it installs every workspace. To add a
dependency to a specific workspace, use
`npm install <package> --workspace @defi-dna/web`.

### Running locally

```bash
npm run dev
```

Starts the `web` workspace. The dev server prints a local URL
(http://localhost:5173 by default).

### Build

```bash
npm run build
```

Builds every workspace that defines a `build` script. The frontend bundle is
written to `web/dist/`. Preview it locally with:

```bash
npm run preview
```

### Lint

```bash
npm run lint      # report problems
npm run lint:fix  # fix what can be fixed automatically
```

ESLint and Prettier are configured once at the root and cover all workspaces.

### Formatting

```bash
npm run format        # write formatting changes
npm run format:check  # verify formatting only
```

### Type checking

```bash
npm run typecheck
```

Runs TypeScript in `--noEmit` mode in every workspace, so no build output is
produced.

### Tests

No test runner is configured yet. When tests are added, a `test` script will be
exposed here and wired into CI. Until then there is intentionally no `npm test`
command, so that a missing test suite cannot pass silently.

### Git hooks

`npm install` sets up [Husky](https://typicode.github.io/husky/). On every
commit, `lint-staged` formats and lints the staged files, then the whole project
is type-checked. A failing check aborts the commit.

## Contributing

Contributions are welcome — please read [CONTRIBUTING.md](CONTRIBUTING.md) and
the [Code of Conduct](CODE_OF_CONDUCT.md) first. Security issues are handled
separately, see [SECURITY.md](SECURITY.md).

## License

Licensed under the GNU Affero General Public License v3.0 only
(`AGPL-3.0-only`). See [LICENSE](LICENSE) for the full text.

Risk assessments quoted from third-party feeds remain the property of their
respective providers and are not covered by this license; each quote is
attributed and linked to its source.
