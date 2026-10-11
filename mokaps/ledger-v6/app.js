;(() => {
  'use strict'

  const D = window.DnaMock
  const page = document.body.dataset.page
  const $ = (selector, root = document) => root.querySelector(selector)

  if (!D) {
    const main = $('main')
    if (main)
      main.innerHTML =
        '<div class="route-error"><h1>Snapshot unavailable</h1><p>The local project snapshot did not load. Reload this file with data.js and shared.js beside the mockup folders.</p></div>'
    return
  }

  const E = D.escapeHtml
  const categoryNames = {
    aggregator: 'Swap aggregator',
    dex: 'DEX / AMM',
    lending: 'Lending',
    'liquid-staking': 'Liquid staking',
    yield: 'Yield / vault',
  }
  const categoryName = (key) => categoryNames[key] || key.replace(/-/g, ' ')
  const sourceEntry = (record, feedId) => record?.feeds?.[feedId] || null
  const isCollected = (entry) => D.isAvailable(entry)
  const isDemo = (feedOrEntry) => D.isDemo(feedOrEntry)
  const assessmentDate = (entry) =>
    entry?.updatedAt ? D.formatDate(entry.updatedAt) : 'Not dated in the source record'
  const collectionDate = (entry) =>
    entry?.fetchedAt ? D.formatDate(entry.fetchedAt) : 'No collection date in snapshot'
  const safeUrl = (value) => {
    if (typeof value !== 'string') return null
    try {
      const url = new URL(value)
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
    } catch {
      return null
    }
  }
  const externalLink = (url, label, className = '') => {
    const href = safeUrl(url)
    return href
      ? `<a ${className ? `class="${E(className)}" ` : ''}href="${E(href)}" target="_blank" rel="noopener noreferrer">${E(label)} <span aria-hidden="true">↗</span></a>`
      : ''
  }
  const detailUrl = (id, feed) =>
    `protocol.html?id=${encodeURIComponent(id)}${feed ? `&feed=${encodeURIComponent(feed)}` : ''}`

  function groupCoverage(group, feedId) {
    if (isDemo(D.getFeed(feedId))) return { kind: 'demo', text: 'DEMO · unassessed' }
    const entries = group.versions.map((version) => sourceEntry(D.getRecord(version.id), feedId))
    const count = entries.filter(isCollected).length
    const errors = entries.filter((entry) => entry?.status === 'error').length
    const total = group.versions.length
    const kind = errors ? 'partial' : count === 0 ? 'empty' : count === total ? 'full' : 'partial'
    let text =
      total === 1
        ? count
          ? 'Record'
          : errors
            ? 'Collection error'
            : 'No record'
        : `${count} / ${total} versions`
    if (errors && total > 1) text += ` · ${errors} error${errors === 1 ? '' : 's'}`
    return { kind, text }
  }

  function demoPreview(entry) {
    const preview = entry?.preview
    if (!preview) return ''
    const parts = Array.isArray(preview.details) ? preview.details : []
    return `<div class="preview-example"><strong>Format-only example · DEMO</strong><p>${E(preview.title || 'Example block')}</p>${parts.length ? `<ul>${parts.map((part) => `<li>${E(part)}</li>`).join('')}</ul>` : ''}</div>`
  }

  function miniRecord(versionId, feed) {
    const entry = sourceEntry(D.getRecord(versionId), feed.id)
    if (isDemo(feed) || entry?.status === 'unassessed-preview') {
      return `<div class="mini-record demo-record">
        <strong>${E(feed.name)} <span class="demo-tag">DEMO</span></strong>
        <span class="mini-value demo-status">Not connected · unassessed</span>
        <span class="mini-scope">${E(feed.focus)}</span>
        ${entry?.preview ? `<details class="mini-preview"><summary>See format-only example</summary>${demoPreview(entry)}</details>` : ''}
      </div>`
    }
    const collected = isCollected(entry)
    const scope =
      feed.id === 'philidor' ? 'Individual vaults only · no protocol-level rating' : feed.focus
    const value = collected
      ? `<span class="mini-value">${E(entry.value)}</span>`
      : `<span class="no-record">${entry?.status === 'error' ? 'Collection error' : 'No record for this version'}</span>`
    const dateLine = collected
      ? `Source assessed: ${assessmentDate(entry)} · Project collected: ${collectionDate(entry)}`
      : `Project checked: ${collectionDate(entry)}`
    return `<div class="mini-record">
      <strong>${E(feed.name)}</strong> ${value}
      <span class="mini-scope">${E(scope)}</span>
      <span class="mini-dates">${E(dateLine)}</span>
      ${collected ? externalLink(entry.url, `Read ${feed.name} record`) : ''}
    </div>`
  }

  function versionCard(version) {
    const record = D.getRecord(version.id)
    const tvl = record?.metrics?.tvl
    const actual = D.connectedFeeds.map((feed) => miniRecord(version.id, feed)).join('')
    const candidates = D.feeds.filter(isDemo)
    return `<article class="version-card">
      <div class="version-card-header"><h3><a href="${E(detailUrl(version.id))}">${E(version.name)}</a></h3></div>
      <p class="version-description">${E(version.description || '')}</p>
      <p class="version-meta">Ethereum TVL for this version: <strong>${E(D.formatUsd(tvl?.value))}</strong> · ${externalLink(tvl?.url, 'DefiLlama source')}</p>
      <div class="record-list">${actual}</div>
      ${candidates.length ? `<details class="demo-list"><summary>${candidates.length} DEMO source names · unassessed</summary><div class="record-list">${candidates.map((feed) => miniRecord(version.id, feed)).join('')}</div></details>` : ''}
    </article>`
  }

  function renderIndex() {
    const search = $('#protocol-search')
    const category = $('#category-filter')
    const rows = $('#protocol-rows')
    const count = $('#result-count')
    const empty = $('#empty-state')
    const expanded = new Set()
    let sort = { field: null, direction: null }

    const candidates = D.feeds.length - D.connectedFeeds.length
    document.body.classList.toggle('dense-table', candidates > 0)
    $('#snapshot-note').textContent =
      `Project snapshot ${D.formatDate(D.generatedAt)} · ${D.connectedFeeds.length} connected sources${candidates ? ` · ${D.feeds.length} names in DEMO preview` : ''}`
    $('#table-footnote').textContent =
      `The ${D.connectedFeeds.length} connected sources retain their original records. ${candidates ? `${candidates} DEMO names are unassessed and not connected; preview examples are format-only. ` : ''}A record is technical coverage, not evidence of safety. Philidor rates individual vaults.`
    const hint = $('#scroll-hint')
    hint.hidden = candidates === 0
    if (candidates)
      hint.textContent = `${D.feeds.length} full source names (${D.connectedFeeds.length} connected, ${candidates} DEMO/unassessed). Scroll the table horizontally; the protocol column stays in view.`
    const table = $('.protocol-table')
    const expandHeader = $('#expand-header')
    expandHeader.insertAdjacentHTML(
      'beforebegin',
      D.feeds
        .map(
          (feed) =>
            `<th scope="col" class="feed-header" data-feed="${E(feed.id)}">${E(feed.name)}${isDemo(feed) ? '<span class="demo-tag">DEMO / not connected</span>' : ''}<small>${E(feed.topic)}</small></th>`,
        )
        .join(''),
    )
    if (candidates) {
      const widths = [210, 120, 175, ...D.feeds.map(() => 180), 56]
      table.style.minWidth = `${widths.reduce((sum, width) => sum + width, 0)}px`
      table.insertAdjacentHTML(
        'afterbegin',
        `<colgroup>${widths.map((width) => `<col style="width:${width}px">`).join('')}</colgroup>`,
      )
    }
    const categories = [...new Set(D.groups.map((group) => group.category))].sort((a, b) =>
      categoryName(a).localeCompare(categoryName(b)),
    )
    category.insertAdjacentHTML(
      'beforeend',
      categories
        .map((key) => `<option value="${E(key)}">${E(categoryName(key))}</option>`)
        .join(''),
    )
    const initialParams = new URLSearchParams(window.location.search)
    search.value = initialParams.get('q') || ''
    if (categories.includes(initialParams.get('category')))
      category.value = initialParams.get('category')
    for (const key of (initialParams.get('open') || '').split(',')) {
      if (D.getGroup(key)) expanded.add(key)
    }
    if (
      ['name', 'category', 'tvl'].includes(initialParams.get('sort')) &&
      ['asc', 'desc'].includes(initialParams.get('direction'))
    ) {
      sort = { field: initialParams.get('sort'), direction: initialParams.get('direction') }
    }

    function persistFilters() {
      try {
        const url = new URL(window.location.href)
        search.value ? url.searchParams.set('q', search.value) : url.searchParams.delete('q')
        category.value
          ? url.searchParams.set('category', category.value)
          : url.searchParams.delete('category')
        sort.field ? url.searchParams.set('sort', sort.field) : url.searchParams.delete('sort')
        sort.direction
          ? url.searchParams.set('direction', sort.direction)
          : url.searchParams.delete('direction')
        expanded.size
          ? url.searchParams.set('open', [...expanded].join(','))
          : url.searchParams.delete('open')
        window.history.replaceState(null, '', url.href)
      } catch {
        /* A file browser may not allow history changes. */
      }
    }

    function updateSortButtons() {
      document.querySelectorAll('[data-sort]').forEach((button) => {
        const active = sort.field === button.dataset.sort
        const arrow = active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'
        button.querySelector('.sort-indicator').textContent = arrow
        button.setAttribute('aria-pressed', String(active))
        button.setAttribute(
          'aria-label',
          `${button.textContent.trim().replace(/[↑↓↕]/g, '').trim()}: ${active ? `${sort.direction}ending; click to ${sort.direction === 'asc' ? 'reverse' : 'clear'} sort` : 'click to sort'}`,
        )
        const th = button.closest('th')
        if (th)
          th.setAttribute(
            'aria-sort',
            active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none',
          )
      })
    }

    function filteredGroups() {
      const query = search.value.trim().toLocaleLowerCase()
      const chosenCategory = category.value
      const result = D.groups.filter((group) => {
        const text = [
          group.name,
          categoryName(group.category),
          ...group.versions.map((version) => version.name),
        ]
          .join(' ')
          .toLocaleLowerCase()
        return (
          (!query || text.includes(query)) && (!chosenCategory || group.category === chosenCategory)
        )
      })
      if (sort.field) {
        const sign = sort.direction === 'asc' ? 1 : -1
        result.sort((left, right) => {
          if (sort.field === 'tvl') {
            const a = left.primaryTvl
            const b = right.primaryTvl
            if (a == null && b == null) return 0
            if (a == null) return 1
            if (b == null) return -1
            return (a - b) * sign
          }
          const a = sort.field === 'category' ? categoryName(left.category) : left.name
          const b = sort.field === 'category' ? categoryName(right.category) : right.name
          return a.localeCompare(b, 'en', { sensitivity: 'base' }) * sign
        })
      }
      return result
    }

    function render() {
      const groups = filteredGroups()
      count.textContent = `${groups.length} / ${D.groups.length}`
      empty.hidden = groups.length > 0
      rows.innerHTML = groups
        .map((group) => {
          const open = expanded.has(group.key)
          const primary =
            group.versions.find((version) => version.id === group.primaryId) || group.versions[0]
          const versionCount = group.versions.length
          const coverageCells = D.feeds
            .map((feed) => {
              const coverage = groupCoverage(group, feed.id)
              return `<td class="feed-cell" data-label="${E(feed.name)}"><span class="coverage ${coverage.kind === 'full' ? '' : E(coverage.kind)}"><span class="coverage-symbol" aria-hidden="true">${coverage.kind === 'full' ? '●' : coverage.kind === 'partial' ? '◐' : coverage.kind === 'demo' ? '◇' : '○'}</span>${E(coverage.text)}</span></td>`
            })
            .join('')
          return `<tr class="main-row" data-group="${E(group.key)}">
          <td><div class="protocol-cell-top"><a class="protocol-link" href="${E(detailUrl(group.primaryId))}">${E(group.name)}</a>${candidates ? `<button class="row-expand dense-expand" type="button" data-expand="${E(group.key)}" aria-expanded="${open}" aria-label="${open ? 'Hide' : 'Show'} ${E(group.name)} version records">${open ? '−' : '+'}</button>` : ''}</div><span class="protocol-subline">${versionCount} ${versionCount === 1 ? 'version' : 'versions'} in this catalog</span></td>
          <td><span class="category-text">${E(categoryName(group.category))}</span></td>
          <td><span class="tvl-value">${E(D.formatUsd(group.primaryTvl))}</span><span class="tvl-subline">${E(primary.name)} · DefiLlama</span></td>
          ${coverageCells}
          <td><button class="row-expand normal-expand" type="button" data-expand="${E(group.key)}" aria-expanded="${open}" aria-label="${open ? 'Hide' : 'Show'} ${E(group.name)} version records">${open ? '−' : '+'}</button></td>
        </tr>${open ? `<tr class="expansion-row"><td colspan="${D.feeds.length + 4}"><div class="version-grid">${group.versions.map(versionCard).join('')}</div></td></tr>` : ''}`
        })
        .join('')
      updateSortButtons()
    }

    document.querySelectorAll('[data-sort]').forEach((button) =>
      button.addEventListener('click', () => {
        const field = button.dataset.sort
        sort = D.sortCycle(sort, field, field === 'tvl' ? 'desc' : 'asc')
        render()
        persistFilters()
      }),
    )
    search.addEventListener('input', () => {
      render()
      persistFilters()
    })
    category.addEventListener('change', () => {
      render()
      persistFilters()
    })
    rows.addEventListener('click', (event) => {
      if (event.target.closest('a')) return
      const row = event.target.closest('tr.main-row')
      if (!row) return
      const key = row.dataset.group
      expanded.has(key) ? expanded.delete(key) : expanded.add(key)
      render()
      persistFilters()
      rows.querySelector(`[data-expand="${CSS.escape(key)}"]`)?.focus({ preventScroll: true })
    })
    render()
  }

  function detailValue(feedId, value) {
    if (feedId === 'defiscan') {
      const full = { L: 'Low', M: 'Medium', H: 'High' }[value]
      if (full) return `${full} (source code: ${value})`
    }
    return String(value ?? 'Not provided')
  }

  function detailItems(feedId, entry) {
    const items = Array.isArray(entry?.details) ? entry.details : []
    if (!items.length) return ''
    const item = (detail) => {
      const description = detail.description
        ? detail.description.length > 160
          ? `<details class="detail-explanation"><summary>Read explanation</summary><p>${E(detail.description)}</p></details>`
          : `<span class="detail-description">${E(detail.description)}</span>`
        : ''
      return `<div class="detail-item"><dt>${E(detail.name || 'Detail')}</dt><dd>${E(detailValue(feedId, detail.value))}${description}</dd></div>`
    }
    const visible = items.slice(0, 5).map(item).join('')
    const remainder =
      items.length > 5
        ? `<details class="record-disclosure"><summary>Show ${items.length - 5} more ${feedId === 'philidor' ? 'vault examples' : 'details'}</summary><dl class="detail-items">${items.slice(5).map(item).join('')}</dl></details>`
        : ''
    return `<section class="record-section"><h3>${feedId === 'philidor' ? 'Individual vault examples' : feedId === 'defiscan' ? 'DeFiScan dimensions' : 'Source details'}</h3><dl class="detail-items">${visible}</dl>${remainder}</section>`
  }

  function sourcePanel(version, record, feed) {
    const entry = sourceEntry(record, feed.id)
    const hasRecord = isCollected(entry)
    const vault = feed.id === 'philidor'
    const demo = isDemo(feed) || entry?.status === 'unassessed-preview'
    const heading = `<div class="source-panel-head"><div><h2>${E(feed.name)}${demo ? ' <span class="demo-tag">DEMO</span>' : ''}</h2><p>${E(feed.topic)} · ${E(feed.focus)}</p></div><span class="scope-badge${vault ? ' vault' : demo ? ' demo' : ''}">${demo ? 'Not connected · unassessed' : vault ? 'Individual vaults only' : 'One source · own scale'}</span></div>`
    const dates = `<div class="date-grid"><div><span>Source assessed</span><strong>${E(assessmentDate(entry))}</strong></div><div><span>Collected by project</span><strong>${E(collectionDate(entry))}</strong></div></div>`
    const raw = `<details class="record-disclosure"><summary>${demo ? 'View illustrative fixture entry' : 'View raw project snapshot entry'}</summary><pre>${E(JSON.stringify(entry, null, 2))}</pre></details>`
    if (demo) {
      const origin =
        feed.origin === 'rfp-candidate'
          ? 'RFP-listed candidate'
          : 'Fictional source name for layout testing'
      return `${heading}<div class="demo-panel"><h3>DEMO · ${E(origin)}</h3><p>This source is not connected. No assessment of ${E(version.name)} has been collected or checked, and no provider verdict, date or original record link is available.</p>${entry?.note ? `<p>${E(entry.note)}</p>` : ''}${demoPreview(entry)}</div>${raw}`
    }
    if (!hasRecord) {
      const state =
        entry?.status === 'error'
          ? 'The project could not collect this source entry.'
          : 'No record for this version in the project snapshot.'
      return `${heading}<div class="no-record-panel"><h3>${E(state)}</h3><p>This is a coverage state, not an assessment of ${E(version.name)}. ${entry?.note ? E(entry.note) : ''}</p></div>${dates}${raw}`
    }
    const note = entry.note
      ? `<section class="record-section"><h3>Record note</h3><p class="source-note">${E(entry.note)}</p></section>`
      : ''
    const summary = entry.summary
      ? `<section class="record-section"><h3>Summary in project snapshot</h3>${
          entry.summary.length > 240
            ? `<details class="long-copy"><summary>Read summary</summary><p>${E(entry.summary)}</p></details>`
            : `<p>${E(entry.summary)}</p>`
        }</section>`
      : ''
    const actions = [
      externalLink(entry.url, `Read ${feed.name} original record`, 'action-link primary'),
      externalLink(feed.methodologyUrl, `${feed.name} methodology`, 'action-link'),
    ]
      .filter(Boolean)
      .join('')
    return `${heading}<div class="source-value${vault ? ' vault' : ''}"><small>${vault ? 'Vault records in this version · no protocol-level rating' : 'Value in this source record'}</small><strong>${E(entry.value)}</strong></div>${dates}<div class="source-actions">${actions}</div>${summary}${detailItems(feed.id, entry)}${note}${raw}`
  }

  function renderProtocol() {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id') || 'aave-v3'
    const record = D.getRecord(id)
    const group = D.groups.find((candidate) =>
      candidate.versions.some((version) => version.id === id),
    )
    const version = group?.versions.find((candidate) => candidate.id === id)
    if (!record || !group || !version) {
      $('#route-error').hidden = false
      return
    }
    $('#detail-content').hidden = false
    $('#breadcrumb-name').textContent = version.name
    $('#version-title').textContent = version.name
    $('#version-description').textContent = version.description || ''
    $('#version-category').textContent = categoryName(version.category)
    $('#version-tvl').textContent = D.formatUsd(record.metrics?.tvl?.value)
    $('#tvl-provenance').innerHTML =
      `DefiLlama · Ethereum · collected ${E(collectionDate(record.metrics?.tvl))} ${externalLink(record.metrics?.tvl?.url, 'Source')}`
    const covered = D.connectedFeeds.filter((feed) =>
      isCollected(sourceEntry(record, feed.id)),
    ).length
    const candidates = D.feeds.length - D.connectedFeeds.length
    document.body.classList.toggle('dense-table', candidates > 0)
    $('#version-coverage').textContent = `${covered} / ${D.connectedFeeds.length}`
    $('#preview-count').textContent = candidates
      ? `${candidates} DEMO names remain unassessed · no risk score`
      : 'Technical coverage, not a risk score'
    $('#source-rail-title').textContent = candidates ? 'Sources and DEMO names' : 'Risk sources'
    $('#source-rail-note').textContent = candidates
      ? `${D.connectedFeeds.length} connected sources · ${candidates} DEMO names, not connected`
      : 'Choose one original source record.'
    document.title = `${version.name} · DeFi DNA Ledger mockup`

    const selector = $('#version-select')
    selector.innerHTML = group.versions
      .map(
        (item) =>
          `<option value="${E(item.id)}"${item.id === id ? ' selected' : ''}>${E(item.name)}</option>`,
      )
      .join('')
    selector.addEventListener('change', () => {
      const next = new URL('protocol.html', window.location.href)
      next.searchParams.set('id', selector.value)
      if (D.feeds.some((feed) => feed.id === selectedFeedId))
        next.searchParams.set('feed', selectedFeedId)
      window.location.href = next.href
    })

    let selectedFeedId = D.feeds.some((feed) => feed.id === params.get('feed'))
      ? params.get('feed')
      : D.feeds.find((feed) => isCollected(sourceEntry(record, feed.id)))?.id || D.feeds[0]?.id
    if (params.get('feed') && params.get('feed') !== selectedFeedId) {
      try {
        const url = new URL(window.location.href)
        url.searchParams.set('feed', selectedFeedId)
        window.history.replaceState(null, '', url.href)
      } catch {
        /* The visible source still falls back if file history is restricted. */
      }
    }
    const list = $('#source-list')
    function renderSelection() {
      list.innerHTML = D.feeds
        .map((feed) => {
          const collected = isCollected(sourceEntry(record, feed.id))
          const demo = isDemo(feed)
          const status = demo
            ? 'DEMO · unassessed'
            : collected
              ? 'Record'
              : sourceEntry(record, feed.id)?.status === 'error'
                ? 'Error'
                : 'No record'
          return `<button type="button" class="source-choice${demo ? ' demo-choice' : ''}" data-feed="${E(feed.id)}" aria-pressed="${feed.id === selectedFeedId}"><strong>${E(feed.name)}</strong><span class="status-word${collected ? '' : ' empty'}">${E(status)}</span><span>${E(demo ? `${feed.type} · not connected` : feed.id === 'philidor' ? 'Individual vaults' : feed.topic)}</span></button>`
        })
        .join('')
      const selectedFeed = D.feeds.find((feed) => feed.id === selectedFeedId)
      $('#source-panel').innerHTML = sourcePanel(version, record, selectedFeed)
      $('#source-lens-link').href = `../v7/?feed=${encodeURIComponent(selectedFeedId)}`
      const selectedButton = list.querySelector(`[data-feed="${CSS.escape(selectedFeedId)}"]`)
      if (selectedButton && list.scrollHeight > list.clientHeight) {
        const item = selectedButton.getBoundingClientRect()
        const viewport = list.getBoundingClientRect()
        if (item.top < viewport.top || item.bottom > viewport.bottom) {
          list.scrollTop += item.top - viewport.top - 12
        }
      }
    }
    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-feed]')
      if (!button) return
      selectedFeedId = button.dataset.feed
      renderSelection()
      list
        .querySelector(`[data-feed="${CSS.escape(selectedFeedId)}"]`)
        ?.focus({ preventScroll: true })
      try {
        const next = new URL(window.location.href)
        next.searchParams.set('feed', selectedFeedId)
        window.history.replaceState(null, '', next.href)
      } catch {
        /* file URLs can restrict history changes; the source still switches. */
      }
    })
    renderSelection()
  }

  if (page === 'index') renderIndex()
  if (page === 'protocol') renderProtocol()
})()
