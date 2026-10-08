import { describe, expect, it } from 'vitest'
import { assess } from './index.ts'

const sample = {
  success: true,
  protocol: { slug: 'lido', name: 'Lido', category: 'Liquid Staking' },
  score: 46,
  band: 'red',
  pillars: {
    trust: { weight: 0.4, value: 50, age_days: null, audit_count: 2, audit_component: 50 },
    liveness: {
      weight: 0.3,
      value: 85,
      tvl_usd: 24_856_947_826,
      tvl_change_7d_pct: -5.91,
    },
    security: {
      weight: 0.3,
      value: 0,
      real: false,
      detail: 'Source code unavailable',
    },
  },
  methodology: 'S = 0.4*Trust + 0.3*Liveness + 0.3*Security',
  sources: ['defillama'],
  timestamp: '2026-10-07T19:51:52.905Z',
  disclaimer: 'Not financial advice.',
}

describe('assess', () => {
  it('quotes score, band and pillars without inventing a scale', () => {
    const result = assess('lido', sample)
    expect(result).toMatchObject({
      value: '46 · red',
      summary: 'S = 0.4*Trust + 0.3*Liveness + 0.3*Security',
      updatedAt: '2026-10-07',
      url: 'https://defiscoring.com/protocols/lido',
      extra: {
        overallScore: 46,
        riskLevel: 'red',
        text: ['Not financial advice.'],
      },
    })
    expect(result.details).toEqual([
      { name: 'Trust', value: '50', description: 'audit_count: 2' },
      { name: 'Liveness', value: '85', description: 'tvl_change_7d_pct: -5.91' },
      {
        name: 'Security',
        value: '0',
        description: 'Source code unavailable · real: false',
      },
    ])
    expect(result.note).toContain(
      'Pillars marked real: false — Security (Source code unavailable).',
    )
    expect(result.note).toContain('Sources named by DeFi Scoring: defillama')
  })

  it('reports missing scores as no value, not an error', () => {
    expect(assess('missing', { success: false })).toMatchObject({
      url: 'https://defiscoring.com/protocols/missing',
      note: 'DeFi Scoring has published no score for missing.',
    })
  })
})
