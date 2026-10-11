/* Shared, read-only contract for the three standalone UX explorations. */
;(() => {
  'use strict'

  const snapshot = window.DNA_SNAPSHOT
  if (!snapshot) throw new Error('Load data.js before shared.js')

  const modes = new Set(['real', 'demo14', 'demo24'])
  let storedMode
  try {
    storedMode = window.localStorage.getItem('dna_view_mode')
  } catch {
    /* file:// can deny storage. */
  }
  const mode = modes.has(storedMode) ? storedMode : 'demo14'
  const fixture = window.DNA_DEMO_FEEDS
  if (
    mode !== 'real' &&
    (!fixture || fixture.rfp?.length !== 11 || fixture.stress?.length !== 10)
  ) {
    throw new Error('Load demo-feeds.js after data.js and before shared.js')
  }
  const connectedFeeds = snapshot.feeds
  const feeds =
    mode === 'real'
      ? connectedFeeds
      : [...connectedFeeds, ...fixture.rfp, ...(mode === 'demo24' ? fixture.stress : [])]

  const previewFormats = {
    Rating: [
      'Example rating field · DEMO',
      'Example scale label',
      'Example assessed-object label',
      'Example methodology label',
    ],
    Dashboard: [
      'Example dashboard block · DEMO',
      'Example metric heading',
      'Example chart caption',
      'Example data-scope label',
    ],
    Monitoring: [
      'Example monitoring block · DEMO',
      'Example event heading',
      'Example monitored-object label',
      'Example alert-context label',
    ],
    Research: [
      'Example research block · DEMO',
      'Example report heading',
      'Example subject label',
      'Example evidence-section label',
    ],
  }

  function previewEntry(feed, versionIndex, feedIndex) {
    const format = previewFormats[feed.type]
    const depth = (versionIndex + feedIndex) % 4
    return {
      status: 'unassessed-preview',
      demo: true,
      note:
        feed.origin === 'rfp-candidate'
          ? 'DEMO: RFP-listed candidate. This project snapshot has not assessed or connected this feed.'
          : 'DEMO: fictional source for layout testing. No provider assessment exists.',
      ...(depth
        ? {
            preview: {
              kind: feed.type.toLowerCase(),
              title: format[0],
              details: format.slice(1, depth + 1),
            },
          }
        : {}),
    }
  }

  const records =
    mode === 'real'
      ? snapshot.records
      : Object.fromEntries(
          Object.entries(snapshot.records).map(([id, record], versionIndex) => {
            const previewFeeds = Object.fromEntries(
              feeds
                .slice(connectedFeeds.length)
                .map((feed, feedIndex) => [feed.id, previewEntry(feed, versionIndex, feedIndex)]),
            )
            return [id, { ...record, feeds: { ...record.feeds, ...previewFeeds } }]
          }),
        )

  const indexById = new Map(snapshot.index.map((row) => [row.id, row]))
  const grouped = new Map()

  for (const version of snapshot.registry) {
    // Morpho Blue (lending) and Morpho Vaults (yield) are different products.
    const groupName = version.group === 'Morpho' ? null : version.group
    const key = groupName ? groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : version.id
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        name: groupName || version.name,
        category: version.category,
        versions: [],
        primaryId: null,
        primaryTvl: null,
      })
    }
    grouped.get(key).versions.push(version)
  }

  const groups = [...grouped.values()]
  for (const group of groups) {
    // A group TVL is never a sum of different protocol versions. Choose the
    // version with the largest measured Ethereum TVL and retain its identity.
    const primary = group.versions.reduce((best, version) => {
      const tvl = indexById.get(version.id)?.tvl
      if (typeof tvl !== 'number' || !Number.isFinite(tvl)) return best
      return best === null || tvl > best.tvl ? { id: version.id, tvl } : best
    }, null)
    group.primaryId = primary?.id ?? group.versions[0].id
    group.primaryTvl = primary?.tvl ?? null
  }

  const groupByKey = new Map(groups.map((group) => [group.key, group]))
  const feedById = new Map(feeds.map((feed) => [feed.id, feed]))
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const amountFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

  function formatUsd(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'TVL unavailable'
    const amount = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    for (const [threshold, unit] of [
      [1e12, 'T'],
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'K'],
    ]) {
      if (amount >= threshold) return `${sign}$${amountFormatter.format(amount / threshold)}${unit}`
    }
    return `${sign}$${amountFormatter.format(amount)}`
  }

  function formatDate(value) {
    if (typeof value !== 'string' || !value.trim()) return 'Date unavailable'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date)
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character],
    )
  }

  function sortCycle(state, field, firstDirection = 'asc') {
    const first = firstDirection === 'desc' ? 'desc' : 'asc'
    if (state?.field !== field || !state?.direction) return { field, direction: first }
    if (state.direction === first) {
      return { field, direction: first === 'asc' ? 'desc' : 'asc' }
    }
    return { field: null, direction: null }
  }

  const stateLabels = {
    ok: 'Record collected',
    none: 'No record for this version in the project snapshot',
    error: 'Collection error',
    'unassessed-preview': 'Not assessed in the project snapshot · DEMO',
  }

  window.DnaMock = {
    generatedAt: snapshot.generatedAt,
    mode,
    feeds,
    connectedFeeds,
    groups,
    records,
    getGroup: (key) => groupByKey.get(key) ?? null,
    getRecord: (id) => records[id] ?? null,
    getFeed: (id) => feedById.get(id) ?? null,
    feedScope: (id) => feedById.get(id)?.focus ?? 'Scope unavailable',
    isAvailable: (entry) => entry?.status === 'ok' && entry?.demo !== true && entry.value != null,
    isDemo: (feedOrEntry) => feedOrEntry?.demo === true,
    sourceState: (entry) => ({
      kind: entry?.status ?? 'unknown',
      label: stateLabels[entry?.status] ?? 'Collection state unknown',
    }),
    formatUsd,
    formatDate,
    escapeHtml,
    sortCycle,
  }
})()
