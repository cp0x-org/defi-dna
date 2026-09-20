# Contributing

Thanks for taking the time to contribute to **defi DNA**. This guide covers the
basics.

## Getting started

1. Fork the repository and clone your fork:

   ```bash
   git clone <your-fork-url>
   cd <repository-directory>
   ```

2. Install dependencies (this also installs the Git hooks):

   ```bash
   npm install
   ```

   The repository is an npm workspaces monorepo; a single root `npm install`
   covers every workspace. Application code lives in workspaces such as `apps/web/`,
   never at the root. Add dependencies with
   `npm install <package> --workspace @defi-dna/web`.

3. Create a feature branch:

   ```bash
   git checkout -b feat/short-description
   ```

## Branch naming

Use a short, descriptive name with one of these prefixes:

- `feat/*` — new functionality
- `fix/*` — bug fixes
- `docs/*` — documentation only
- `refactor/*` — code changes without behaviour changes
- `chore/*` — tooling, dependencies, maintenance

## Before opening a pull request

Run the same checks CI runs:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Everything must pass. Do not bypass the Git hooks (`--no-verify`).

## Pull requests

- Keep pull requests focused: one logical change per PR.
- Explain what changed and why, using the pull request template.
- Update the documentation when behaviour, setup or commands change.
- Never commit credentials, private keys, tokens or other secrets. Use `.env`
  (git-ignored) locally and document new variables in `.env.example`.

## Corrections to published data

Corrections to what a feed is quoted as saying — a
misquote, a wrong source link, a stale entry — will follow the same pull request
flow, against the data files, with the source link in the description. The
generated data is collected by the pipeline and published separately.

## License

By contributing you agree that your contributions are licensed under the
project's [AGPL-3.0-only](LICENSE) license. Quotes from third-party risk feeds
stay the property of their providers and must always carry an attribution and a
link to the original source.

## Code of Conduct

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
