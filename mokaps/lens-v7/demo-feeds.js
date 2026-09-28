/* Names and format examples for UX density testing. No source is connected here. */
;(() => {
  'use strict'

  const rfp = [
    [
      'curatorwatch',
      'CuratorWatch',
      'Dashboard',
      'Vault-level monitoring of Morpho curators and allocation risk.',
    ],
    [
      'blockanalitica',
      'BlockAnalitica',
      'Dashboard',
      'On-chain lending-market exposure, liquidations and collateral health.',
    ],
    [
      'defipunkd',
      "DeFiPunk'd",
      'Rating',
      'Control, exit, autonomy, access and verifiability dimensions.',
    ],
    ['pharos', 'Pharos', 'Monitoring', 'Live protocol-risk event monitoring and alerts.'],
    ['defi-sphere', 'DeFi Sphere', 'Rating', 'Technical, financial and operational risk analysis.'],
    [
      'defi-saver',
      'DeFi Saver',
      'Dashboard',
      'Loan health and liquidation statistics for leveraged positions.',
    ],
    ['credora', 'Credora', 'Rating', 'Credit-risk assessments for protocols and borrowers.'],
    [
      'pigi-finance',
      'pigi.finance',
      'Dashboard',
      'Vault analytics, yield comparison and historical incident context.',
    ],
    ['xerberus', 'Xerberus', 'Rating', 'Vault-focused risk mechanisms and subscores.'],
    [
      'zyfai-risk',
      'Zyfai Risk',
      'Dashboard',
      'Pool risk metrics, TVL, APY and source-defined grades.',
    ],
    [
      'llamarisk',
      'LlamaRisk',
      'Research',
      'Collateral and governance research with parameter recommendations.',
    ],
  ].map(([id, name, type, focus]) => ({
    id,
    name,
    type,
    topic: `${type} · DEMO`,
    focus: `RFP-listed candidate; not connected. ${focus}`,
    demo: true,
    connected: false,
    origin: 'rfp-candidate',
  }))

  const stress = [
    ['demo-feed-15', 'DEMO source 15 · Vault exposure view', 'Dashboard'],
    ['demo-feed-16', 'DEMO source 16 · Governance change watch', 'Monitoring'],
    ['demo-feed-17', 'DEMO source 17 · Protocol control review', 'Rating'],
    ['demo-feed-18', 'DEMO source 18 · Asset dependency research notes', 'Research'],
    ['demo-feed-19', 'DEMO source 19 · Liquidation and collateral monitor', 'Monitoring'],
    ['demo-feed-20', 'DEMO source 20 · Market concentration dashboard', 'Dashboard'],
    ['demo-feed-21', 'DEMO source 21 · Vault curator methodology report', 'Research'],
    ['demo-feed-22', 'DEMO source 22 · Upgrade authority assessment', 'Rating'],
    ['demo-feed-23', 'DEMO source 23 · Long-form incident and recovery research', 'Research'],
    ['demo-feed-24', 'DEMO source 24 · Cross-protocol dependency exposure dashboard', 'Dashboard'],
  ].map(([id, name, type]) => ({
    id,
    name,
    type,
    topic: `${type} · DEMO`,
    focus: `Fictional ${type.toLowerCase()} source used only to test layout at 24 feeds.`,
    demo: true,
    connected: false,
    origin: 'fictional-layout-test',
  }))

  window.DNA_DEMO_FEEDS = { rfp, stress }
})()
