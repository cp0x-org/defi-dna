import type { Detail, FeedAdapter, FeedResult } from '@defi-dna/core'

/*
 * A feed adapter: how the pipeline reads one risk feed. Copy this folder, keep
 * what applies, delete the rest. Everything the adapter may return is described
 * in ../feed-output.schema.json; the rules it works under are in ../../README.md.
 *
 * The one rule behind all the others: we store what the feed published, with
 * the feed's URL and the feed's date. No value is converted, rounded, graded
 * or combined with another feed's.
 */

/* ------------------------------------------------------------------ source */

/**
 * Where the feed publishes machine-readable data. A documented API first, a
 * public repository second, hand-curated data third. An undocumented endpoint
 * behind the provider's web app needs the provider's written permission; the
 * verdicts themselves are never scraped from a page.
 */
const API = 'https://example.com/api'
/** The page a reader opens to check a value. */
const SITE = 'https://example.com/protocol'
/**
 * How long a response may be served from the on-disk cache (seconds). Match
 * the feed's own cadence: a feed that recomputes nightly needs no hourly reads,
 * and a quota-limited API is read as rarely as its data allows.
 */
const TTL = 6 * 3600
/** Dates some feeds publish for "never updated". Never shown as a date. */
const NO_DATE = ['1970-01-01', '0000-00-00']
/** Longest excerpt we quote from the feed's own text. */
const SUMMARY_CHARS = 700

/** What the feed's own endpoints return. Replace with the real shape; keep only the fields you read. */
interface Listed {
  id: string
}
interface Assessment {
  rating: string
  text?: string
  dimensions?: { name: string; value: string; why?: string }[]
  updated?: string
}

const trim = (text: string | undefined): string | undefined => {
  const flat = text?.replace(/\s+/g, ' ').trim()
  if (!flat) return undefined
  return flat.length > SUMMARY_CHARS ? `${flat.slice(0, SUMMARY_CHARS - 1).trimEnd()}…` : flat
}

/* ----------------------------------------------------------------- adapter */

/**
 * <Feed name> — <one line on what it publishes, in the feed's own terms>.
 *
 * Say here what a maintainer needs to know: what the feed assesses (the
 * protocol, each deployment, individual vaults ...), how its ids relate to our
 * rows, quotas and keys, anything surprising in its data.
 *
 * The type parameter is whatever prepare() returns; collect() receives it typed.
 */
const adapter: FeedAdapter<Set<string>> = {
  // Must equal the folder name and the id in feed.json; the pipeline refuses a mismatch.
  id: '_template',

  // Environment variables the feed needs, if any. Online, a missing one skips the
  // feed for the whole run with one line; --offline reads need none. Document
  // the variable in .env.example and pass it in .github/workflows/refresh-data.yml.
  // secrets: ['EXAMPLE_API_KEY'],

  /**
   * Optional. Runs once per run, before any protocol; whatever it returns is
   * handed to every collect() call as `prepared`. Use it for a listing the feed
   * publishes once (all protocols, all vaults) so the per-protocol pass makes
   * no further requests. If it throws, collect() is not called: the column
   * keeps the previous run's values and the failure is reported once.
   */
  async prepare(ctx): Promise<Set<string>> {
    // Every id the mapping names, for a listing that can be filtered server-side:
    //   const wanted = new Set(Object.values(ctx.mapping).flat())
    const listed = await ctx.getJson<Listed[]>(`${API}/protocols`, { ttlSeconds: TTL })
    ctx.log(`${listed.length} protocols listed`)

    // A paged listing: loop until the page says it is the last, keep a hard cap.
    //   for (let page = 1; page <= MAX_PAGES; page++) { ... if (page >= body.totalPages) break }
    //
    // A key-protected API: read the key from the environment and trade it for a
    // token lazily, through the `headers` function of getJson. The function runs
    // only when the request really goes to the network, so a cached or --offline
    // read never needs the key. See adapters/feeds/pigi/index.ts.
    //   const apiKey = process.env.EXAMPLE_API_KEY
    //   let token: Promise<string> | undefined
    //   const headers = async () => {
    //     if (!apiKey) throw new Error('EXAMPLE_API_KEY is not set')
    //     token ??= ctx.postJson<{ token: string }>(`${API}/auth/token`, { apiKey }).then((b) => b.token)
    //     return { authorization: `Bearer ${await token}` }
    //   }
    //   await ctx.getJson(url, { ttlSeconds: TTL, headers })

    return new Set(listed.map((entry) => entry.id))
  },

  /**
   * Read one protocol. Three answers, and the difference between them is what
   * keeps a broken run from looking like a coverage gap:
   *   - `null`                      the feed does not cover this protocol  → grey cell, "No data"
   *   - `{ note }` without `value`  listed, but nothing published yet      → grey cell, with the reason
   *   - throw                       we could not read the source           → previous value kept, failure reported
   */
  async collect({ protocol, ctx, prepared }): Promise<FeedResult | null> {
    // ctx.mapping is this folder's mapping.json with every value as a list.
    const ids = ctx.mapping[protocol.id] ?? []
    const [id] = ids
    if (!id) return null

    // Several ids under one row (`"aave-v3": ["aave/ethereum.md", "aave/prime.md"]`):
    // read them all, show every value joined with ' · ', and say so in `note`.
    // Never pick one to stand in for the rest. See adapters/feeds/defiscan/index.ts.

    const url = `${SITE}/${id}`
    if (!prepared.has(id)) {
      return { url, note: `The feed lists no assessment for ${protocol.name}.` }
    }

    // Throwing is for "we could not read the source" — never for "not covered".
    const assessment = await ctx.getJson<Assessment>(`${API}/protocols/${id}`, {
      ttlSeconds: TTL,
    })

    // The feed's own date, never the time we fetched it; sentinels are not dates.
    const published = assessment.updated?.slice(0, 10)
    const updatedAt = published && !NO_DATE.includes(published) ? published : undefined

    // The feed's own breakdown: dimensions, sub-scores, the vaults it rates. Keep
    // it to ~10 entries; `description` is shown behind a dropdown.
    const details: Detail[] = (assessment.dimensions ?? []).map((dimension) => ({
      name: dimension.name,
      value: dimension.value,
      ...(dimension.why ? { description: dimension.why } : {}),
    }))

    const summary = trim(assessment.text)

    return {
      // The headline, verbatim, as a string: "Stage 1", "4.8/10 · medium", "7 vaults rated".
      value: assessment.rating,
      // The feed's own words about the protocol, quoted. Never our prose about it.
      ...(summary ? { summary } : {}),
      details,
      ...(updatedAt ? { updatedAt } : {}),
      // Where a reader checks the value. Required whenever there is a value.
      url,
      // What the data covers and what was left out — a fact about coverage, never a judgement.
      note: `The feed files ${protocol.name} as "${id}".`,
      // Structured data beyond the headline, in the shapes the site renders:
      // facts (name/value pairs), reviews, findings, vaults, incidents, components,
      // text. Pick from these; cap lists (100 vaults). If nothing fits, use `text`.
      extra: {
        facts: [{ name: 'Filed under', value: id }],
      },
    }
  },
}

export default adapter
