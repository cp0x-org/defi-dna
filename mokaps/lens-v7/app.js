;(() => {
  'use strict'

  const model = window.DnaMock
  const escape = model.escapeHtml
  const feeds = model.feeds.filter((feed) => feed.enabled !== false)
  const query = new URLSearchParams(window.location.search)
  const firstFeed = feeds.find((feed) => feed.id === query.get('feed')) ?? feeds[0]
  const snapshotDate = document.getElementById('snapshot-date')
  snapshotDate.textContent = model.formatDate(model.generatedAt)
  const demoCount = feeds.length - model.connectedFeeds.length
  document.getElementById('mode-caption').textContent = demoCount
    ? `${feeds.length} names in preview: ${model.connectedFeeds.length} connected, ${demoCount} DEMO not connected`
    : `${model.connectedFeeds.length} connected sources`

  const scopeName = (feedId) =>
    ({
      defiscan: 'Decentralization review of the named deployment',
      philidor: 'Individual Ethereum vault ratings; no protocol-level score',
      risklayer: 'Beta protocol analysis in Risklayer’s own scale',
    })[feedId] ?? model.feedScope(feedId)

  const recordFor = (versionId, feedId) => model.getRecord(versionId)?.feeds?.[feedId] ?? null
  const versionName = (group, id) => group.versions.find((version) => version.id === id)?.name ?? id
  const shownVersionId = (group, feedId) => {
    if (recordFor(group.primaryId, feedId)?.status === 'ok') return group.primaryId
    return (
      group.versions.find((version) => recordFor(version.id, feedId)?.status === 'ok')?.id ??
      group.primaryId
    )
  }
  const assessedLongBeforeSnapshot = (entry) => {
    if (!entry?.updatedAt) return false
    const age = new Date(model.generatedAt).getTime() - new Date(entry.updatedAt).getTime()
    return Number.isFinite(age) && age > 365 * 24 * 60 * 60 * 1000
  }
  const externalLink = (url, label) => {
    if (!url || !/^https?:\/\//i.test(url)) return ''
    return `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`
  }
  const detailHref = (group, versionId, feedId) =>
    `protocol.html?protocol=${encodeURIComponent(group.key)}&version=${encodeURIComponent(versionId)}&feed=${encodeURIComponent(feedId)}`

  function replaceQuery(entries) {
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries(entries)) {
      if (value) url.searchParams.set(key, value)
      else url.searchParams.delete(key)
    }
    window.history.replaceState({}, '', url)
  }

  function sourceChoice(feed, selected, entry) {
    const state = entry ? model.sourceState(entry).kind : null
    const demo = model.isDemo(feed)
    const subtitle = demo
      ? state
        ? 'Not assessed for this version'
        : feed.type
      : state === 'ok'
        ? 'Record in this version'
        : state === 'none'
          ? 'No record in this version'
          : state === 'error'
            ? 'Collection error'
            : feed.topic
    return `<button type="button" class="source-choice${demo ? ' is-demo' : ''}" data-feed="${escape(feed.id)}" aria-pressed="${selected === feed.id}">
      <span class="source-glyph" aria-hidden="true"></span><span><strong>${escape(feed.name)}</strong>${demo ? '<span class="demo-badge">DEMO · not connected</span>' : ''}<small>${escape(subtitle)}</small></span></button>`
  }

  function revealSelected(nav, feedId) {
    const target = [...nav.querySelectorAll('[data-feed]')].find(
      (item) => item.dataset.feed === feedId,
    )
    if (!target) return
    const navBox = nav.getBoundingClientRect()
    const itemBox = target.getBoundingClientRect()
    if (itemBox.top < navBox.top || itemBox.bottom > navBox.bottom) {
      nav.scrollTop += itemBox.top - navBox.top - (navBox.height - itemBox.height) / 2
    }
  }

  function compactRecord(entry, feedId, includeCollection) {
    const state = model.sourceState(entry)
    const demo = model.isDemo(entry) || model.isDemo(model.getFeed(feedId))
    if (demo) {
      return `<div class="record-value is-demo">DEMO · not assessed or connected</div>
        ${entry?.preview?.title ? `<p class="record-scope">Format example only: ${escape(entry.preview.title)}</p>` : ''}
        <p class="record-date"><span class="date-label">Source assessment:</span> No provider date · DEMO</p>
        ${includeCollection ? '<p class="record-date"><span class="date-label">Collected by cp0x:</span> Not connected · DEMO</p>' : ''}`
    }
    const hasRecord = model.isAvailable(entry)
    const value = hasRecord
      ? escape(entry.value ?? 'Original value unavailable')
      : escape(state.label)
    const assessed =
      hasRecord && entry.updatedAt
        ? model.formatDate(entry.updatedAt)
        : 'No source assessment in this snapshot'
    const collected = entry?.fetchedAt
      ? model.formatDate(entry.fetchedAt)
      : 'Collection date unavailable'
    const collectionLabel =
      state.kind === 'none'
        ? 'Checked by cp0x'
        : state.kind === 'error'
          ? 'Collection attempt by cp0x'
          : 'Collected by cp0x'
    return `<div class="record-value${hasRecord ? '' : ' is-missing'}">${value}</div>
      ${hasRecord ? `<p class="record-scope">${escape(scopeName(feedId))}</p>` : ''}
      <p class="record-date${assessedLongBeforeSnapshot(entry) ? ' is-old' : ''}"><span class="date-label">Source assessment:</span> ${escape(assessed)}</p>
      ${includeCollection ? `<p class="record-date"><span class="date-label">${escape(collectionLabel)}:</span> ${escape(collected)}</p>` : ''}`
  }

  function indexPage() {
    const sourceNav = document.getElementById('source-nav')
    const list = document.getElementById('protocol-list')
    const search = document.getElementById('protocol-search')
    const heading = document.getElementById('results-heading')
    const description = document.getElementById('source-description')
    const count = document.getElementById('result-count')
    const sortStatus = document.getElementById('sort-status')
    const sortButtons = [...document.querySelectorAll('[data-sort]')]
    let selectedFeed = firstFeed
    let sort = { field: null, direction: null }
    search.value = query.get('q') ?? ''

    function renderRail() {
      const previousScroll = sourceNav.scrollTop
      sourceNav.innerHTML = feeds.map((feed) => sourceChoice(feed, selectedFeed.id)).join('')
      sourceNav.scrollTop = previousScroll
      revealSelected(sourceNav, selectedFeed.id)
    }
    function sortedGroups() {
      const needle = search.value.trim().toLocaleLowerCase()
      const filtered = model.groups.filter((group) =>
        `${group.name} ${group.category} ${group.versions.map((version) => version.name).join(' ')}`
          .toLocaleLowerCase()
          .includes(needle),
      )
      if (!sort.field) return filtered
      const direction = sort.direction === 'desc' ? -1 : 1
      return filtered.slice().sort((a, b) => {
        let result = 0
        if (sort.field === 'name') result = a.name.localeCompare(b.name)
        if (sort.field === 'tvl') result = (a.primaryTvl ?? -Infinity) - (b.primaryTvl ?? -Infinity)
        if (sort.field === 'date') {
          const aTime =
            Date.parse(
              recordFor(shownVersionId(a, selectedFeed.id), selectedFeed.id)?.updatedAt ?? '',
            ) || -Infinity
          const bTime =
            Date.parse(
              recordFor(shownVersionId(b, selectedFeed.id), selectedFeed.id)?.updatedAt ?? '',
            ) || -Infinity
          result = aTime - bTime
        }
        return result === 0 || Number.isNaN(result)
          ? (model.groups.indexOf(a) - model.groups.indexOf(b)) * direction
          : result * direction
      })
    }
    function primaryTvl(group) {
      return `<div class="tvl-cell"><span class="tvl-value">${escape(model.formatUsd(group.primaryTvl))}</span><span class="tvl-scope">${escape(versionName(group, group.primaryId))} · DefiLlama TVL</span></div>`
    }
    function versionRow(group, version) {
      const entry = recordFor(version.id, selectedFeed.id)
      const tvl = model.getRecord(version.id)?.metrics?.tvl?.value
      return `<div class="version-line" data-version="${escape(version.id)}">
        <a href="${detailHref(group, version.id, selectedFeed.id)}">${escape(version.name)}</a>
        <div>${compactRecord(entry, selectedFeed.id, true)}</div>
        <div class="tvl-cell"><span class="tvl-value">${escape(model.formatUsd(tvl))}</span><span class="tvl-scope">This version · DefiLlama TVL</span></div>
      </div>`
    }
    function groupRow(group) {
      const displayId = shownVersionId(group, selectedFeed.id)
      const entry = recordFor(displayId, selectedFeed.id)
      const action = model.isDemo(selectedFeed)
        ? 'Inspect DEMO status'
        : model.isAvailable(entry)
          ? `Read ${selectedFeed.name} record`
          : `Inspect ${selectedFeed.name} status`
      const versions =
        group.versions.length > 1
          ? `<details class="version-disclosure"><summary>See all ${group.versions.length} separate versions</summary>${group.versions.map((version) => versionRow(group, version)).join('')}</details>`
          : ''
      return `<article class="protocol-entry" data-protocol="${escape(group.key)}"><div class="protocol-row">
        <div><a class="protocol-name" href="${detailHref(group, displayId, selectedFeed.id)}">${escape(group.name)}</a><span class="protocol-category">${escape(group.category)}</span></div>
        <div><div class="version-name">${escape(versionName(group, displayId))} · ${escape(selectedFeed.name)}</div>${compactRecord(entry, selectedFeed.id, true)}<a class="row-link" href="${detailHref(group, displayId, selectedFeed.id)}">${escape(action)} for ${escape(versionName(group, displayId))}</a></div>
        ${primaryTvl(group)}
      </div>${versions}</article>`
    }
    function renderResults() {
      if (selectedFeed.demo && sort.field === 'date') sort = { field: null, direction: null }
      const groups = sortedGroups()
      heading.textContent = selectedFeed.name
      description.textContent = selectedFeed.demo
        ? `DEMO · not connected. ${selectedFeed.focus}`
        : selectedFeed.focus
      count.textContent = `${groups.length} ${groups.length === 1 ? 'protocol' : 'protocols'}`
      list.innerHTML = groups.length
        ? groups.map(groupRow).join('')
        : '<div class="empty-results"><h3>No matching protocol</h3><p>Try a different name, version, or category.</p></div>'
      const labels = {
        name: 'Protocol',
        tvl: 'Primary version TVL',
        date: `${selectedFeed.name} assessment date on the shown version`,
      }
      sortStatus.textContent = sort.field
        ? `Sorted by ${labels[sort.field]}, ${sort.direction === 'asc' ? 'ascending' : 'descending'}. Click again to reverse; click a third time to clear.`
        : selectedFeed.demo
          ? 'Original order. This DEMO source has no assessment dates; sort by protocol or TVL.'
          : 'Original order. Select a heading to sort.'
      for (const button of sortButtons) {
        const active = sort.field === button.dataset.sort
        button.disabled = button.dataset.sort === 'date' && Boolean(selectedFeed.demo)
        button.title = button.disabled
          ? 'No provider assessment dates exist for an unconnected DEMO source'
          : ''
        button.dataset.active = String(active)
        button.querySelector('.sort-arrow').textContent = active
          ? sort.direction === 'asc'
            ? '↑'
            : '↓'
          : ''
        button.setAttribute(
          'aria-label',
          `${button.textContent.trim()}${active ? `, ${sort.direction}ending` : ', not sorted'}`,
        )
      }
    }
    sourceNav.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-feed]')
      if (!button) return
      selectedFeed = feeds.find((feed) => feed.id === button.dataset.feed) ?? selectedFeed
      replaceQuery({ feed: selectedFeed.id })
      renderRail()
      renderResults()
      sourceNav.querySelector(`[data-feed="${selectedFeed.id}"]`)?.focus()
    })
    search.addEventListener('input', () => {
      replaceQuery({ q: search.value.trim() })
      renderResults()
    })
    for (const button of sortButtons) {
      button.addEventListener('click', () => {
        sort = model.sortCycle(sort, button.dataset.sort, button.dataset.first)
        renderResults()
      })
    }
    renderRail()
    renderResults()
  }

  function fullSourcePanel(versionId, feed) {
    const entry = recordFor(versionId, feed.id)
    const state = model.sourceState(entry)
    const demo = model.isDemo(feed) || model.isDemo(entry)
    if (demo) {
      const preview = entry?.preview
      return `<article class="source-panel is-demo" data-panel-feed="${escape(feed.id)}">
        <p class="panel-status is-demo">DEMO · not connected</p>
        <h2>${escape(feed.name)}</h2><p class="panel-subtitle">${escape(feed.type ?? 'Source')} format preview · no provider assessment</p>
        <p class="original-value is-demo">No provider record</p>
        <p class="scope-statement"><strong>Illustrative focus:</strong> ${escape(feed.focus ?? 'Layout preview only')}</p>
        <dl class="date-grid"><div><dt>Source assessment</dt><dd>No provider date · DEMO</dd></div><div><dt>Collected by cp0x</dt><dd>Not connected · DEMO</dd></div></dl>
        <p class="source-note">${escape(entry?.note ?? 'DEMO: this source is not connected or assessed in the project snapshot.')}</p>
        ${preview ? `<div class="format-preview"><h3 class="evidence-title">Format example only · DEMO</h3><p>${escape(preview.title)}</p>${preview.details?.length ? `<ul>${preview.details.map((part) => `<li>${escape(part)}</li>`).join('')}</ul>` : ''}</div>` : ''}
      </article>`
    }
    const hasRecord = model.isAvailable(entry)
    const value = hasRecord ? (entry.value ?? 'Original value unavailable') : state.label
    const sourceDate =
      hasRecord && entry.updatedAt
        ? model.formatDate(entry.updatedAt)
        : 'No source assessment in this snapshot'
    const collectionDate = entry?.fetchedAt
      ? model.formatDate(entry.fetchedAt)
      : 'Collection date unavailable'
    const collectionLabel =
      state.kind === 'none'
        ? 'Checked by cp0x'
        : state.kind === 'error'
          ? 'Collection attempt by cp0x'
          : 'Collected by cp0x'
    const old = assessedLongBeforeSnapshot(entry)
    const details = hasRecord && Array.isArray(entry.details) ? entry.details : []
    let detailBlocks = ''
    if (details.length && feed.id === 'defiscan') {
      const label = (raw) =>
        raw === 'L' ? 'Low' : raw === 'H' ? 'High' : raw === 'M' ? 'Medium' : raw
      detailBlocks = `<h3 class="evidence-title">DeFiScan dimensions</h3><dl class="detail-fields">${details
        .map(
          (item) =>
            `<div class="detail-field"><dt>${escape(item.name)}</dt><dd>${escape(label(item.value))} <small>(original: ${escape(item.value)})</small></dd></div>`,
        )
        .join('')}</dl>`
    } else if (details.length) {
      const countNote =
        feed.id === 'philidor' && typeof entry.extra?.vaultsRated === 'number'
          ? ` · ${details.length} shown of ${entry.extra.vaultsRated} rated vaults in this snapshot`
          : ''
      detailBlocks = `<h3 class="evidence-title">Source details${escape(countNote)}</h3><div class="evidence-list">${details
        .map(
          (item) =>
            `<details class="evidence-item"><summary><span>${escape(item.name)}</span><span class="evidence-value">${escape(item.value)}</span></summary>${item.description ? `<p>${escape(item.description)}</p>` : ''}</details>`,
        )
        .join('')}</div>`
    }
    const links = hasRecord
      ? [
          externalLink(entry.url, `Read ${feed.name} record`),
          externalLink(feed.methodologyUrl, `${feed.name} methodology`),
        ]
          .filter(Boolean)
          .join('')
      : ''
    return `<article class="source-panel" data-panel-feed="${escape(feed.id)}">
      <p class="panel-status${hasRecord ? '' : ' is-missing'}">${escape(state.label)}</p>
      <h2>${escape(feed.name)}</h2><p class="panel-subtitle">${escape(feed.topic)}</p>
      <p class="original-value${hasRecord ? '' : ' is-missing'}">${escape(value)}</p>
      <p class="scope-statement"><strong>${hasRecord ? 'Applies to:' : 'Source focus:'}</strong> ${escape(scopeName(feed.id))}</p>
      <dl class="date-grid"><div class="${old ? 'date-old' : ''}"><dt>Source assessment</dt><dd>${escape(sourceDate)}</dd></div><div><dt>${escape(collectionLabel)}</dt><dd>${escape(collectionDate)}</dd></div></dl>
      ${old ? '<p class="date-explanation">This source assessment predates the frozen snapshot by more than one year. The record was still collected on the date at right.</p>' : ''}
      ${links ? `<div class="source-actions">${links}</div>` : ''}
      ${entry?.note ? `<p class="source-note">${escape(entry.note)}</p>` : ''}
      ${detailBlocks}
      ${hasRecord && entry.summary ? `<details class="text-disclosure"><summary>Read ${escape(feed.name)} summary</summary><p>${escape(entry.summary)}</p></details>` : ''}
      ${hasRecord ? `<details class="text-disclosure"><summary>Show raw source record</summary><pre class="raw-json">${escape(JSON.stringify(entry, null, 2))}</pre></details>` : ''}
    </article>`
  }

  function protocolPage() {
    const groupKey = query.get('protocol')
    const group =
      model.getGroup(groupKey) ??
      model.groups.find((candidate) =>
        candidate.versions.some((version) => version.id === groupKey),
      )
    const error = document.getElementById('route-error')
    const detail = document.getElementById('detail')
    if (!group) {
      error.hidden = false
      error.innerHTML =
        '<h1>Protocol not found</h1><p>This link does not match the frozen registry.</p><a href="index.html">Browse protocols</a>'
      return
    }
    const requestedVersion = query.get('version')
    if (requestedVersion && !group.versions.some((version) => version.id === requestedVersion)) {
      error.hidden = false
      error.innerHTML =
        '<h1>Version not found</h1><p>This version does not belong to the selected protocol.</p><a href="index.html">Browse protocols</a>'
      return
    }
    let versionId = requestedVersion ?? group.primaryId
    let selectedFeed = firstFeed
    let comparedFeed = null
    const nav = document.getElementById('detail-source-nav')
    const panels = document.getElementById('source-panels')
    const versionSelect = document.getElementById('version-select')
    const compareSelect = document.getElementById('compare-select')
    const backLink = document.getElementById('back-link')
    detail.hidden = false
    document.title = `${group.name} · Source lens`
    document.getElementById('protocol-title').textContent = group.name
    document.getElementById('protocol-description').textContent =
      `${group.category.charAt(0).toUpperCase() + group.category.slice(1)} · Feed records stay separate by version and source.`
    versionSelect.innerHTML = group.versions
      .map((version) => `<option value="${escape(version.id)}">${escape(version.name)}</option>`)
      .join('')

    function updateRoute() {
      replaceQuery({
        protocol: group.key,
        version: versionId,
        feed: selectedFeed.id,
        compare: comparedFeed?.id ?? null,
      })
      backLink.href = `index.html?feed=${encodeURIComponent(selectedFeed.id)}`
    }
    function render() {
      const entries = model.getRecord(versionId)?.feeds ?? {}
      versionSelect.value = versionId
      const previousScroll = nav.scrollTop
      nav.innerHTML = feeds
        .map((feed) => sourceChoice(feed, selectedFeed.id, entries[feed.id]))
        .join('')
      nav.scrollTop = previousScroll
      revealSelected(nav, selectedFeed.id)
      compareSelect.innerHTML = `<option value="">None</option>${feeds
        .filter((feed) => feed.id !== selectedFeed.id)
        .map(
          (feed) =>
            `<option value="${escape(feed.id)}">${escape(feed.name)}${feed.demo ? ' · DEMO not connected' : ''}</option>`,
        )
        .join('')}`
      compareSelect.value = comparedFeed?.id ?? ''
      panels.classList.toggle('is-comparing', Boolean(comparedFeed))
      panels.innerHTML =
        fullSourcePanel(versionId, selectedFeed) +
        (comparedFeed ? fullSourcePanel(versionId, comparedFeed) : '')
      updateRoute()
    }
    nav.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-feed]')
      if (!button) return
      selectedFeed = feeds.find((feed) => feed.id === button.dataset.feed) ?? selectedFeed
      if (comparedFeed?.id === selectedFeed.id) comparedFeed = null
      render()
      nav.querySelector(`[data-feed="${selectedFeed.id}"]`)?.focus()
    })
    compareSelect.addEventListener('change', () => {
      comparedFeed = feeds.find((feed) => feed.id === compareSelect.value) ?? null
      render()
      compareSelect.focus()
    })
    versionSelect.addEventListener('change', () => {
      versionId = versionSelect.value
      render()
      versionSelect.focus()
    })
    if (query.get('compare') && query.get('compare') !== selectedFeed.id)
      comparedFeed = feeds.find((feed) => feed.id === query.get('compare')) ?? null
    render()
  }

  if (document.body.dataset.page === 'protocol') protocolPage()
  else indexPage()
})()
