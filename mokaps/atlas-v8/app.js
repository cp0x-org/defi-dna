;(() => {
  'use strict'

  const D = window.DnaMock
  if (!D) throw new Error('The shared mockup data must load before Atlas')
  const esc = D.escapeHtml
  const $ = (selector) => document.querySelector(selector)
  const categoryNames = {
    lending: 'Lending',
    dex: 'DEX / AMM',
    aggregator: 'Swap aggregator',
    yield: 'Yield / vault',
    'liquid-staking': 'Liquid staking',
  }
  const stateNames = {
    record: 'Record collected',
    none: 'No record for this version',
    old: 'Collection overdue in demo scenario',
    error: 'Collection failed in demo scenario',
    preview: 'Candidate preview; no collection performed',
  }
  const stateOrder = { record: 0, old: 1, error: 2, none: 3, preview: 4 }

  function safeUrl(value) {
    try {
      const url = new URL(value)
      return ['http:', 'https:'].includes(url.protocol) ? url.href : null
    } catch {
      return null
    }
  }

  function versionLabel(group, id) {
    return group.versions.find((version) => version.id === id)?.name || id
  }

  function sourceScope(feed, versionName) {
    const id = feed.id
    if (feed.demo) return `Candidate preview for ${versionName}. ${feed.focus}`
    if (id === 'philidor')
      return `Individual vaults inside ${versionName}; this is not a protocol-wide rating.`
    if (id === 'defiscan') return `Decentralization maturity of ${versionName}.`
    if (id === 'risklayer') return `Protocol analysis of ${versionName}.`
    return `Source record for ${versionName}.`
  }

  function primaryRecord(group) {
    return D.getRecord(group.primaryId)
  }

  function sourcesFor(group, versionId, issueDemo) {
    const record = D.getRecord(versionId)
    return D.feeds.map((feed) => {
      const entry = record?.feeds?.[feed.id] || null
      let state =
        entry?.status === 'ok'
          ? 'record'
          : entry?.status === 'error'
            ? 'error'
            : entry?.status === 'none'
              ? 'none'
              : 'preview'
      let demo = Boolean(feed.demo)
      if (issueDemo && group.key === 'aave' && versionId === 'aave-v3') {
        if (feed.id === 'defiscan') {
          state = 'old'
          demo = true
        }
        if (feed.id === 'risklayer') {
          state = 'error'
          demo = true
        }
      }
      return { id: feed.id, name: feed.name, topic: feed.topic, feed, entry, state, demo }
    })
  }

  function dataAgeNote(entry) {
    if (!entry?.updatedAt) return ''
    const assessed = new Date(entry.updatedAt).getTime()
    const snapshot = new Date(D.generatedAt).getTime()
    if (!Number.isFinite(assessed) || !Number.isFinite(snapshot)) return ''
    return snapshot - assessed > 365 * 86400000
      ? 'Source assessment older than one year at snapshot'
      : ''
  }

  function makeArc(startDeg, endDeg, radius = 34) {
    const point = (angle) => {
      const radians = (angle * Math.PI) / 180
      return [50 + radius * Math.cos(radians), 50 + radius * Math.sin(radians)]
    }
    const [x1, y1] = point(startDeg)
    const [x2, y2] = point(endDeg)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
  }

  function orderedSources(sources, order) {
    return order === 'state'
      ? [...sources].sort(
          (a, b) => stateOrder[a.state] - stateOrder[b.state] || a.name.localeCompare(b.name),
        )
      : sources
  }

  function ringMarkup(group, sources, order) {
    const arranged = orderedSources(sources, order)
    const step = 360 / arranged.length
    const gap = Math.min(3, step * 0.17)
    const paths = arranged
      .map((source, index) => {
        const start = index * step + gap / 2
        const end = (index + 1) * step - gap / 2
        return `<path class="ring-path ${source.state}" data-feed="${esc(source.id)}" d="${makeArc(start, end)}"><title>${esc(source.name)}: ${esc(stateNames[source.state])}</title></path>`
      })
      .join('')
    const records = sources.filter((source) => source.entry?.status === 'ok').length
    const label = `${records} original records from ${D.connectedFeeds.length} connected sources for ${group.name}; ${sources.length} named feeds in this view`
    const caption =
      D.mode === 'real'
        ? '3 connected sources'
        : `${D.connectedFeeds.length} connected · ${sources.length} names DEMO`
    return `<button type="button" class="ring-button" data-ring="${esc(group.key)}" aria-label="${esc(label)}. Show source records" aria-haspopup="dialog" aria-controls="inspector" aria-expanded="false"><svg viewBox="0 0 100 100" role="img" aria-hidden="true"><circle class="ring-track" cx="50" cy="50" r="34"></circle>${paths}</svg><span class="ring-center"><strong>${records}</strong><span>original</span></span></button><div class="ring-caption">${caption}</div>`
  }

  function sourceListText(group) {
    const feedNames = sourcesFor(group, group.primaryId, false)
      .filter((item) => item.entry?.status === 'ok')
      .map((item) => item.name)
    return feedNames.length ? feedNames.join(', ') : 'No feed record in this snapshot'
  }

  function sampleRingMarkup(order) {
    const buckets = {
      green: Array(5).fill('green'),
      yellow: Array(10).fill('yellow'),
      red: Array(4).fill('red'),
      gray: Array(5).fill('gray'),
    }
    const arranged =
      order === 'grouped'
        ? [...buckets.green, ...buckets.yellow, ...buckets.red, ...buckets.gray]
        : (() => {
            const mixed = []
            while (Object.values(buckets).some((items) => items.length)) {
              for (const key of ['yellow', 'gray', 'green', 'red']) {
                if (buckets[key].length) mixed.push(buckets[key].shift())
              }
            }
            return mixed
          })()
    const step = 360 / arranged.length
    const paths = arranged
      .map((colour, index) => {
        const start = index * step + 0.9
        const end = (index + 1) * step - 0.9
        const meaning = {
          green: 'positive',
          yellow: 'neutral',
          red: 'negative',
          gray: 'no conclusion',
        }[colour]
        return `<path class="sample-segment sample-${colour}" d="${makeArc(start, end, 34)}"><title>Illustrative ${meaning} label · DEMO</title></path>`
      })
      .join('')
    return `<div class="sample-ring-wrap"><svg class="sample-ring-${order}" viewBox="0 0 100 100" role="img" aria-label="DEMO ring with 5 positive, 10 neutral, 4 negative and 5 no-conclusion segments, ${order} order"><circle class="ring-track" cx="50" cy="50" r="34"></circle>${paths}</svg><span class="sample-ring-center">24<small>DEMO</small></span></div>`
  }

  function sampleCardMarkup() {
    return `<section class="sample-signal-card" id="colour-demo" aria-labelledby="colour-demo-title">
      <div class="sample-copy"><div class="sample-heading"><h3 id="colour-demo-title">A busier circle, with colour groups</h3><span class="sample-badge">DEMO</span></div><p>Twenty-four invented source labels shown two ways. This tests visual balance only; no real feed verdict or protocol assessment is represented.</p><div class="sample-counts"><span><i class="sample-dot sample-green"></i>5 positive</span><span><i class="sample-dot sample-yellow"></i>10 neutral</span><span><i class="sample-dot sample-red"></i>4 negative</span><span><i class="sample-dot sample-gray"></i>5 no conclusion</span></div></div>
      <div class="sample-comparison"><div><strong>Grouped labels</strong>${sampleRingMarkup('grouped')}</div><div><strong>Fixed source order</strong>${sampleRingMarkup('mixed')}</div></div>
    </section>`
  }

  function cardMarkup(group, state) {
    const record = primaryRecord(group)
    const sources = sourcesFor(group, group.primaryId, state.issueDemo)
    const category = categoryNames[group.category] || group.category
    const detailHref = `protocol.html?group=${encodeURIComponent(group.key)}&version=${encodeURIComponent(group.primaryId)}`
    return `<article class="protocol-card category-${esc(group.category)}" data-card="${esc(group.key)}">
      <div class="card-main">
        <div class="card-title-row"><span class="protocol-avatar" aria-hidden="true">${esc(group.name.slice(0, 1))}</span><h3 class="card-title"><a href="${detailHref}">${esc(group.name)}</a></h3>${group.versions.length > 1 ? `<span class="version-count">${group.versions.length} versions</span>` : ''}</div>
        <div class="card-category">${esc(category)} · ${esc(versionLabel(group, group.primaryId))} shown</div>
        <div class="card-metric">${esc(D.formatUsd(group.primaryTvl))}<small>DefiLlama TVL · ${esc(versionLabel(group, group.primaryId))} · collected ${esc(D.formatDate(record?.metrics?.tvl?.fetchedAt))}</small></div>
        <div class="card-meta"><strong>Original records:</strong> ${esc(sourceListText(group))}${D.mode === 'real' ? '' : `<span class="preview-count"> · ${D.feeds.length - D.connectedFeeds.length} candidate names · DEMO</span>`}</div>
      </div>
      <div class="card-ring-zone">${ringMarkup(group, sources, state.order)}</div>
    </article>`
  }

  function initIndex() {
    $('#snapshot-date').textContent = D.formatDate(D.generatedAt)
    const state = {
      search: '',
      category: 'all',
      sort: { field: null, direction: null },
      order: 'feed',
      issueDemo: false,
      inspectorGroup: null,
      activeFeed: null,
      inspectorFilter: 'all',
      pinned: false,
    }
    const cards = $('#cards')
    const inspector = $('#inspector')
    const pendingKey = 'dna_atlas_density_change'
    let pending = null
    try {
      const raw = sessionStorage.getItem(pendingKey)
      sessionStorage.removeItem(pendingKey)
      const saved = raw && JSON.parse(raw)
      if (saved?.pathname === location.pathname && Date.now() - saved.savedAt < 30000)
        pending = saved.state
    } catch {
      /* Storage can be unavailable on some file:// browsers. */
    }
    if (pending) {
      state.search = typeof pending.search === 'string' ? pending.search : ''
      state.category = [...$('#category').options].some(
        (option) => option.value === pending.category,
      )
        ? pending.category
        : 'all'
      state.sort =
        ['tvl', 'name', 'coverage'].includes(pending.sort?.field) &&
        ['asc', 'desc'].includes(pending.sort?.direction)
          ? pending.sort
          : { field: null, direction: null }
      state.order = pending.order === 'state' ? 'state' : 'feed'
      state.issueDemo = Boolean(pending.issueDemo)
      $('#search').value = state.search
      $('#category').value = state.category
      $('#demo-failure').checked = state.issueDemo
      document
        .querySelectorAll('[data-order]')
        .forEach((button) =>
          button.setAttribute('aria-pressed', String(button.dataset.order === state.order)),
        )
    }

    function coverage(group) {
      return sourcesFor(group, group.primaryId, false).filter((item) => item.entry?.status === 'ok')
        .length
    }

    function listGroups() {
      const search = state.search.trim().toLowerCase()
      const filtered = D.groups.filter((group) => {
        if (state.category !== 'all' && group.category !== state.category) return false
        return (
          !search ||
          [group.name, group.category, ...group.versions.map((version) => version.name)]
            .join(' ')
            .toLowerCase()
            .includes(search)
        )
      })
      const { field, direction } = state.sort
      filtered.sort((a, b) => {
        if (field === 'name')
          return direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        if (field === 'coverage')
          return direction === 'asc'
            ? coverage(a) - coverage(b) || a.name.localeCompare(b.name)
            : coverage(b) - coverage(a) || a.name.localeCompare(b.name)
        const aTvl = a.primaryTvl ?? -1
        const bTvl = b.primaryTvl ?? -1
        const effectiveDirection = field === 'tvl' ? direction : 'desc'
        return effectiveDirection === 'asc'
          ? aTvl - bTvl || a.name.localeCompare(b.name)
          : bTvl - aTvl || a.name.localeCompare(b.name)
      })
      return filtered
    }

    function updateSortUi() {
      document.querySelectorAll('[data-sort]').forEach((button) => {
        const active = button.dataset.sort === state.sort.field
        button.setAttribute('aria-pressed', String(active))
        button.querySelector('.sort-indicator').textContent = active
          ? state.sort.direction === 'asc'
            ? '↑'
            : '↓'
          : ''
      })
      $('#sort-description').textContent = state.sort.field
        ? `Sorted by ${state.sort.field === 'tvl' ? 'primary version TVL' : state.sort.field === 'coverage' ? 'number of source records' : 'name'}, ${state.sort.direction === 'asc' ? 'ascending' : 'descending'}`
        : 'Default: primary version TVL, highest first'
    }

    function renderCards() {
      const groups = listGroups()
      $('#result-count').textContent = groups.length
      if (groups.length) {
        const markup = groups.map((group) => cardMarkup(group, state))
        if (D.mode !== 'real' && !state.search.trim() && state.category === 'all')
          markup.splice(2, 0, sampleCardMarkup())
        cards.innerHTML = markup.join('')
      } else {
        cards.innerHTML =
          '<div class="empty-results"><strong>No matching protocol</strong>Try another name or category.</div>'
      }
      if (state.inspectorGroup && groups.some((group) => group.key === state.inspectorGroup)) {
        cards.querySelector(`[data-card="${state.inspectorGroup}"]`)?.classList.add('selected')
        cards
          .querySelector(`[data-ring="${state.inspectorGroup}"]`)
          ?.setAttribute('aria-expanded', 'true')
      }
      updateSortUi()
    }

    function markActiveFeed() {
      cards.querySelectorAll('.ring-path.active').forEach((path) => path.classList.remove('active'))
      inspector
        .querySelectorAll('.inspector-item.active')
        .forEach((item) => item.classList.remove('active'))
      if (!state.inspectorGroup || !state.activeFeed) return
      cards
        .querySelector(
          `[data-card="${state.inspectorGroup}"] .ring-path[data-feed="${state.activeFeed}"]`,
        )
        ?.classList.add('active')
      inspector
        .querySelector(`.inspector-item[data-feed="${state.activeFeed}"]`)
        ?.classList.add('active')
    }

    function inspectorItem(source, versionName) {
      const hasRecord = source.entry?.status === 'ok'
      const preview = source.entry?.status === 'unassessed-preview'
      const date = source.entry?.updatedAt
        ? D.formatDate(source.entry.updatedAt)
        : 'Not given by source'
      const collected = source.entry?.fetchedAt
        ? D.formatDate(source.entry.fetchedAt)
        : 'No successful read in snapshot'
      const note = dataAgeNote(source.entry)
      const value = hasRecord
        ? source.entry.value || 'Record without headline value'
        : preview
          ? 'Candidate not connected; no assessment collected'
          : source.state === 'error' && source.demo
            ? 'Stored record retained; collection failure is illustrative'
            : 'No record for this version in project snapshot'
      const link = `<a href="protocol.html?group=${encodeURIComponent(state.inspectorGroup)}&version=${encodeURIComponent(D.getGroup(state.inspectorGroup).primaryId)}&feed=${encodeURIComponent(source.id)}">${hasRecord ? `Read ${esc(source.name)} record` : preview ? `View ${esc(source.name)} format preview` : `View ${esc(source.name)} coverage state`}</a>`
      const dateLine = preview
        ? '<span class="feed-dates">No source assessment or project collection performed · DEMO</span>'
        : `<span class="feed-dates">Source assessed: ${esc(date)} · Collected: ${esc(collected)}</span>`
      const example =
        preview && source.entry.preview
          ? `<span class="feed-preview">${esc(source.entry.preview.title)} · format only</span>`
          : ''
      return `<div class="inspector-item" data-feed="${esc(source.id)}"><span class="state-swatch state-${esc(source.state)}" aria-hidden="true"></span><div><h3>${esc(source.name)} ${source.feed.demo ? '<small>DEMO candidate</small>' : source.demo ? '<small>DEMO issue</small>' : ''}</h3><span class="feed-topic">${esc(source.topic || '')}</span><div class="feed-value">${esc(value)}</div>${hasRecord || preview ? `<span class="feed-scope">${esc(sourceScope(source.feed, versionName))}</span>` : ''}${example}${dateLine}${note ? `<span class="feed-status issue">${esc(note)}</span>` : ''}${source.demo && source.state === 'old' ? '<span class="feed-status issue">DEMO: last successful collection is 40h old at the scenario clock; daily collection is overdue after 36h.</span>' : ''}${source.demo && source.state === 'error' ? '<span class="feed-status issue">DEMO: latest collection attempt failed. The original stored value is retained.</span>' : ''}${link}</div></div>`
    }

    function renderInspector() {
      const group = D.getGroup(state.inspectorGroup)
      if (!group) return
      const sources = sourcesFor(group, group.primaryId, state.issueDemo)
      const filtered = sources.filter(
        (source) =>
          state.inspectorFilter === 'all' ||
          (state.inspectorFilter === 'record'
            ? source.entry?.status === 'ok'
            : source.entry?.status !== 'ok'),
      )
      $('#inspector-title').textContent = group.name
      $('#inspector-subtitle').textContent =
        `${versionLabel(group, group.primaryId)} · ${sources.filter((source) => source.entry?.status === 'ok').length} original records · ${D.connectedFeeds.length} connected sources${D.mode === 'real' ? '' : ` · ${sources.length} names in DEMO view`}`
      $('#inspector-detail-link').href =
        `protocol.html?group=${encodeURIComponent(group.key)}&version=${encodeURIComponent(group.primaryId)}${state.activeFeed ? `&feed=${encodeURIComponent(state.activeFeed)}` : ''}`
      document
        .querySelectorAll('[data-inspector-filter]')
        .forEach((button) =>
          button.setAttribute(
            'aria-pressed',
            String(button.dataset.inspectorFilter === state.inspectorFilter),
          ),
        )
      $('#inspector-list').innerHTML = filtered.length
        ? filtered
            .map((source) => inspectorItem(source, versionLabel(group, group.primaryId)))
            .join('')
        : '<p class="feed-status">No sources in this view.</p>'
      markActiveFeed()
    }

    function placeInspector(groupKey) {
      if (window.innerWidth <= 780) {
        inspector.style.left = ''
        inspector.style.right = ''
        inspector.style.top = ''
        return
      }
      const trigger = cards.querySelector(`[data-ring="${groupKey}"]`)
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const panelWidth = Math.min(440, window.innerWidth - 24)
      const rightSide = rect.right + 12
      const leftSide = rect.left - panelWidth - 12
      inspector.style.left = `${rightSide + panelWidth <= window.innerWidth - 12 ? rightSide : Math.max(12, leftSide)}px`
      inspector.style.right = 'auto'
      inspector.style.top = '104px'
    }

    function openInspector(groupKey, feedId, pin) {
      if (state.pinned && !pin) return
      state.inspectorGroup = groupKey
      state.activeFeed = feedId || null
      state.pinned = Boolean(pin)
      state.inspectorFilter = 'all'
      placeInspector(groupKey)
      inspector.hidden = false
      cards
        .querySelectorAll('.ring-button[aria-expanded="true"]')
        .forEach((button) => button.setAttribute('aria-expanded', 'false'))
      cards.querySelector(`[data-ring="${groupKey}"]`)?.setAttribute('aria-expanded', 'true')
      cards
        .querySelectorAll('.protocol-card.selected')
        .forEach((card) => card.classList.remove('selected'))
      cards.querySelector(`[data-card="${groupKey}"]`)?.classList.add('selected')
      renderInspector()
    }

    function closeInspector() {
      const returnFocus = inspector.contains(document.activeElement)
      const priorGroup = state.inspectorGroup
      state.inspectorGroup = null
      state.activeFeed = null
      state.pinned = false
      inspector.hidden = true
      cards
        .querySelectorAll('.protocol-card.selected')
        .forEach((card) => card.classList.remove('selected'))
      cards.querySelectorAll('.ring-path.active').forEach((path) => path.classList.remove('active'))
      cards
        .querySelectorAll('.ring-button[aria-expanded="true"]')
        .forEach((button) => button.setAttribute('aria-expanded', 'false'))
      if (returnFocus && priorGroup)
        cards.querySelector(`[data-ring="${priorGroup}"]`)?.focus({ preventScroll: true })
    }

    $('#search').addEventListener('input', (event) => {
      state.search = event.target.value
      closeInspector()
      renderCards()
    })
    $('#category').addEventListener('change', (event) => {
      state.category = event.target.value
      closeInspector()
      renderCards()
    })
    document.querySelectorAll('[data-sort]').forEach((button) =>
      button.addEventListener('click', () => {
        state.sort = D.sortCycle(state.sort, button.dataset.sort, button.dataset.first)
        closeInspector()
        renderCards()
      }),
    )
    document.querySelectorAll('[data-order]').forEach((button) =>
      button.addEventListener('click', () => {
        state.order = button.dataset.order
        document
          .querySelectorAll('[data-order]')
          .forEach((item) => item.setAttribute('aria-pressed', String(item === button)))
        renderCards()
        if (!inspector.hidden) renderInspector()
      }),
    )
    $('#demo-failure').addEventListener('change', (event) => {
      state.issueDemo = event.target.checked
      renderCards()
      if (!inspector.hidden) renderInspector()
    })
    cards.addEventListener('pointerover', (event) => {
      if (window.innerWidth <= 780 || window.matchMedia('(hover: none), (pointer: coarse)').matches)
        return
      const button = event.target.closest?.('.ring-button')
      if (!button) return
      const path = event.target.closest?.('.ring-path')
      if (state.pinned) return
      if (
        state.inspectorGroup === button.dataset.ring &&
        state.activeFeed === (path?.dataset.feed || null) &&
        !inspector.hidden
      )
        return
      openInspector(button.dataset.ring, path?.dataset.feed || null, false)
    })
    cards.addEventListener('click', (event) => {
      const button = event.target.closest?.('.ring-button')
      if (!button) return
      event.preventDefault()
      const path = event.target.closest?.('.ring-path')
      openInspector(button.dataset.ring, path?.dataset.feed || null, true)
      if (event.detail === 0) $('#inspector-close').focus({ preventScroll: true })
    })
    document.querySelectorAll('[data-inspector-filter]').forEach((button) =>
      button.addEventListener('click', () => {
        state.inspectorFilter = button.dataset.inspectorFilter
        renderInspector()
      }),
    )
    $('#inspector-close').addEventListener('click', closeInspector)
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !inspector.hidden) {
        closeInspector()
        event.preventDefault()
      }
    })
    document.addEventListener('click', (event) => {
      if (
        inspector.hidden ||
        inspector.contains(event.target) ||
        event.target.closest?.('.ring-button')
      )
        return
      closeInspector()
    })
    window.addEventListener('resize', () => {
      if (state.inspectorGroup) placeInspector(state.inspectorGroup)
    })
    window.addEventListener('dna:before-mode-change', () => {
      try {
        sessionStorage.setItem(
          pendingKey,
          JSON.stringify({
            pathname: location.pathname,
            savedAt: Date.now(),
            state: { ...state, sort: { ...state.sort } },
          }),
        )
      } catch {
        /* Current page still changes mode; state falls back to defaults. */
      }
    })

    renderCards()
    if (
      pending?.inspectorGroup &&
      D.getGroup(pending.inspectorGroup) &&
      cards.querySelector(`[data-ring="${pending.inspectorGroup}"]`)
    ) {
      const availableFeed = D.feeds.some((feed) => feed.id === pending.activeFeed)
        ? pending.activeFeed
        : null
      openInspector(pending.inspectorGroup, availableFeed, Boolean(pending.pinned))
      state.inspectorFilter = ['all', 'record', 'missing'].includes(pending.inspectorFilter)
        ? pending.inspectorFilter
        : 'all'
      renderInspector()
      if (pending.pinned) $('#inspector-close').focus({ preventScroll: true })
    }
  }

  function renderDetailRows(id, rows) {
    if (!Array.isArray(rows) || !rows.length) return ''
    const displayValue = (value) => {
      if (id === 'defiscan') {
        const expanded = { L: 'Low (L)', M: 'Medium (M)', H: 'High (H)' }[
          String(value || '').trim()
        ]
        if (expanded) return expanded
      }
      return String(value ?? '')
    }
    return `<details><summary>Read ${rows.length} source detail${rows.length === 1 ? '' : 's'}</summary><div class="detail-body"><table class="detail-table"><tbody>${rows.map((row) => `<tr><th scope="row">${esc(row.name || 'Detail')}</th><td><strong>${esc(displayValue(row.value))}</strong>${row.description ? `<p>${esc(row.description)}</p>` : ''}</td></tr>`).join('')}</tbody></table></div></details>`
  }

  function sourcePanel(feed, entry, versionName) {
    const hasRecord = entry?.status === 'ok'
    const scope = sourceScope(feed, versionName)
    if (entry?.status === 'unassessed-preview') {
      const preview = entry.preview
      return `<p class="scope-note preview-note">DEMO candidate · not connected. No assessment or collection was performed for ${esc(versionName)}.</p>
        <p class="feed-scope">${esc(scope)}</p>
        ${preview ? `<div class="format-preview"><h3>Format-only example · DEMO</h3><p>${esc(preview.title)}</p>${preview.details?.length ? `<ul>${preview.details.map((detail) => `<li>${esc(detail)}</li>`).join('')}</ul>` : ''}</div>` : '<p class="feed-scope">This slot tests source-list density only; it contains no example assessment.</p>'}
        <p class="feed-scope">The example above is UI filler, not a statement by ${esc(feed.name)}.</p>`
    }
    if (!hasRecord)
      return `<p class="scope-note">${entry?.status === 'error' ? 'Collection failed for this version.' : 'No record for this version in the project snapshot.'} This does not say the protocol has no risk or that the provider has never covered it.</p><dl class="date-pair"><div><dt>Project last checked</dt><dd>${esc(D.formatDate(entry?.fetchedAt))}</dd></div></dl>`
    const url = safeUrl(entry.url)
    const methodUrl = safeUrl(feed.methodologyUrl)
    const sourceDate = D.formatDate(entry.updatedAt)
    const collectedDate = D.formatDate(entry.fetchedAt)
    const ageNote = dataAgeNote(entry)
    const fullRecord = JSON.stringify(entry, null, 2)
    return `<div class="scope-note ${feed.id === 'philidor' ? 'vault-note' : ''}">${esc(scope)}</div>
      <dl class="date-pair"><div><dt>Source assessment date</dt><dd>${esc(sourceDate)}${ageNote ? `<br><span class="feed-status issue">${esc(ageNote)}</span>` : ''}</dd></div><div><dt>Project collected record</dt><dd>${esc(collectedDate)}</dd></div></dl>
      <div class="source-original"><h3>Original source value</h3><p>${esc(entry.value || 'No headline value')}</p></div>
      ${entry.note ? `<p class="feed-scope">${esc(entry.note)}</p>` : ''}
      ${entry.summary ? `<details><summary>Read the source's full description</summary><div class="detail-body"><p>${esc(entry.summary)}</p></div></details>` : ''}
      ${renderDetailRows(feed.id, entry.details)}
      <details><summary>Raw record from the project snapshot</summary><div class="detail-body"><pre class="raw-json">${esc(fullRecord)}</pre></div></details>
      ${url ? `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Read ${esc(feed.name)} at the original source ↗</a>` : ''}
      ${methodUrl ? `<a class="source-link" style="margin-left:14px" href="${esc(methodUrl)}" target="_blank" rel="noopener noreferrer">${esc(feed.name)} methodology ↗</a>` : ''}`
  }

  function initProtocol() {
    $('#snapshot-date').textContent = D.formatDate(D.generatedAt)
    const query = new URLSearchParams(location.search)
    const group = D.getGroup(query.get('group') || 'aave')
    const target = $('#protocol-content')
    if (!group) {
      target.innerHTML =
        '<div class="route-error"><h1>Protocol not found</h1><p>This mockup has no entry for that identifier.</p><a href="index.html">Return to the protocol directory</a></div>'
      return
    }
    const versionId = group.versions.some((version) => version.id === query.get('version'))
      ? query.get('version')
      : group.primaryId
    const version = group.versions.find((item) => item.id === versionId)
    const record = D.getRecord(versionId)
    const requestedFeed = query.get('feed')
    let openFeed = D.feeds.some((feed) => feed.id === requestedFeed)
      ? requestedFeed
      : D.feeds.find((feed) => record?.feeds?.[feed.id]?.status === 'ok')?.id || D.feeds[0]?.id
    document.title = `${group.name} · Atlas concept`
    const reportingCount = D.connectedFeeds.filter(
      (feed) => record?.feeds?.[feed.id]?.status === 'ok',
    ).length
    target.innerHTML = `<section class="dossier-head"><div><h1>${esc(group.name)}</h1><p>${esc(version?.description || '')}</p></div><label class="version-select">Protocol version<select id="version-choice">${group.versions.map((item) => `<option value="${esc(item.id)}" ${item.id === versionId ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label></section>
      <div class="overview-strip"><div class="overview-item"><label>DefiLlama TVL</label><strong>${esc(D.formatUsd(record?.metrics?.tvl?.value ?? null))}</strong><small>${esc(version.name)} · collected ${esc(D.formatDate(record?.metrics?.tvl?.fetchedAt))}</small></div><div class="overview-item"><label>Original source records</label><strong>${reportingCount} from ${D.connectedFeeds.length}</strong><small>${D.mode === 'real' ? 'Connected sources · not a risk rating' : `${D.feeds.length - D.connectedFeeds.length} extra candidate names · DEMO`}</small></div></div>
      <div class="dossier-intro"><h2>Source records and candidate previews</h2><p>Connected sources retain their own value, scope and two distinct dates. DEMO candidates were not collected or assessed.</p></div>
      <div class="source-stack">${D.feeds
        .map((feed) => {
          const entry = record?.feeds?.[feed.id]
          const state =
            entry?.status === 'ok'
              ? 'record'
              : entry?.status === 'error'
                ? 'error'
                : entry?.status === 'none'
                  ? 'none'
                  : 'preview'
          const value =
            entry?.status === 'ok'
              ? entry.value || 'Record available'
              : entry?.status === 'unassessed-preview'
                ? 'Not connected · DEMO'
                : entry?.status === 'error'
                  ? 'Collection failed'
                  : 'No project record'
          const selected = feed.id === openFeed
          return `<section class="source-accordion" data-source="${esc(feed.id)}"><button type="button" class="source-trigger" id="trigger-${esc(feed.id)}" aria-expanded="${selected}" aria-controls="panel-${esc(feed.id)}"><span class="state-swatch state-${state}" aria-hidden="true"></span><strong>${esc(feed.name)} ${feed.demo ? '<em class="feed-demo">DEMO</em>' : ''}</strong><span class="trigger-value">${esc(value)}${feed.id === 'philidor' && entry?.status === 'ok' ? ' · vault-level' : ''}</span><span class="trigger-date">${feed.demo ? 'Not assessed' : `Source: ${esc(D.formatDate(entry?.updatedAt))}`}</span></button><div class="source-panel" id="panel-${esc(feed.id)}" role="region" aria-labelledby="trigger-${esc(feed.id)}" ${selected ? '' : 'hidden'}>${sourcePanel(feed, entry, version.name)}</div></section>`
        })
        .join('')}</div>`
    $('#version-choice').addEventListener('change', (event) => {
      const next = new URL(location.href)
      next.searchParams.set('version', event.target.value)
      next.searchParams.delete('feed')
      location.href = next.href
    })
    target.querySelectorAll('.source-trigger').forEach((button) =>
      button.addEventListener('click', () => {
        const feedId = button.closest('.source-accordion').dataset.source
        openFeed = feedId
        target.querySelectorAll('.source-accordion').forEach((section) => {
          const selected = section.dataset.source === feedId
          section.querySelector('.source-trigger').setAttribute('aria-expanded', String(selected))
          section.querySelector('.source-panel').hidden = !selected
        })
        history.replaceState(
          null,
          '',
          `${location.pathname}?group=${encodeURIComponent(group.key)}&version=${encodeURIComponent(versionId)}&feed=${encodeURIComponent(feedId)}`,
        )
      }),
    )
  }

  if (document.body.dataset.page === 'index') initIndex()
  if (document.body.dataset.page === 'protocol') initProtocol()
})()
