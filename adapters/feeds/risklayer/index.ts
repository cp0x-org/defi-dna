import type { Detail, FeedAdapter, FeedResult } from '@defi-dna/core'
import mapping from './mapping.json' with { type: 'json' }

const API = 'https://risklayer.online/api'
const SITE = 'https://risklayer.online/protocol'
const DAY = 86_400
/** Longest excerpt we quote from an analysis. */
const SUMMARY_CHARS = 700
/** Findings carried into `extra` for the protocol page. */
const MAX_FINDINGS = 12

/** our protocol id -> the domain Risklayer files its analysis under */
const table: Record<string, string> = mapping

interface Dimension {
  name: string
  score: number
  rationale?: string
}

interface Analysis {
  status?: string
  summary?: string
  keyFindings?: { title?: string; severity?: string; category?: string; description?: string }[]
  primitives?: { score?: { dimensions?: Dimension[] } }
  createdAt?: string
}

interface ProtocolDetail {
  name?: string
  lastAnalyzedAt?: string | null
  overallScore?: number | null
  riskLevel?: string | null
  dimensions?: Dimension[]
  latestAnalysis?: Analysis | null
}

const trim = (text: string | undefined, max = SUMMARY_CHARS): string | undefined => {
  const flat = text?.replace(/\s+/g, ' ').trim()
  if (!flat) return undefined
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

/**
 * Risklayer (beta) — protocol analysis with a quantitative score.
 *
 * Risklayer publishes a 0-10 figure where a higher number means more risk, plus
 * a word for the band. Both are carried verbatim: they document no ordering for
 * the bands anywhere we can link to, so we add none of our own.
 */
const adapter: FeedAdapter = {
  id: 'risklayer',

  async collect({ protocol, ctx }): Promise<FeedResult | null> {
    const domain = table[protocol.id]
    if (!domain) return null

    const url = `${SITE}/${domain}`
    const detail = await ctx.getJson<ProtocolDetail>(
      `${API}/protocols/${encodeURIComponent(domain)}`,
      { ttlSeconds: DAY },
    )
    const analysis = detail.latestAnalysis ?? null
    const summary = trim(analysis?.summary)
    const score = Number(detail.overallScore)
    const riskLevel = detail.riskLevel ?? null
    const updatedAt = (detail.lastAnalyzedAt ?? analysis?.createdAt ?? '').slice(0, 10)

    if (!Number.isFinite(score) && !riskLevel) {
      return { url, note: `Risklayer lists ${domain} but has published no completed analysis.` }
    }

    const rationales = new Map(
      (analysis?.primitives?.score?.dimensions ?? []).map((d) => [d.name, d.rationale]),
    )
    const details: Detail[] = (detail.dimensions ?? []).flatMap((dimension) => {
      const value = Number(dimension.score)
      if (!dimension.name || !Number.isFinite(value)) return []
      const rationale = trim(rationales.get(dimension.name), 260)
      return [
        {
          name: dimension.name,
          value: `${value.toFixed(1)}/10`,
          ...(rationale ? { description: rationale } : {}),
        },
      ]
    })

    const findings = (analysis?.keyFindings ?? [])
      .filter((finding) => finding.title)
      .slice(0, MAX_FINDINGS)
      .map((finding) => ({
        title: finding.title,
        severity: finding.severity ?? null,
        category: finding.category ?? null,
        description: trim(finding.description, 400) ?? null,
      }))

    return {
      value: [Number.isFinite(score) ? `${score.toFixed(1)}/10` : null, riskLevel]
        .filter(Boolean)
        .join(' · '),
      ...(summary ? { summary } : {}),
      details,
      ...(updatedAt ? { updatedAt } : {}),
      url,
      note: 'Risklayer is in beta and publishes no ordering for its bands, so the figure is shown exactly as reported.',
      extra: {
        domain,
        riskLevel,
        overallScore: Number.isFinite(score) ? score : null,
        analysisStatus: analysis?.status ?? null,
        keyFindings: findings,
      },
    }
  },
}

export default adapter
