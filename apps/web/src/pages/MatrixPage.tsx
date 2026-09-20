import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { IndexBundle } from '@defi-dna/data'
import { readHiddenFeeds, writeHiddenFeeds } from '../lib/prefs.ts'
import { feeds as allFeeds, metricById } from '../lib/registry.ts'
import { dataCount, groupRows, type Group, type Row } from '../lib/rows.ts'
import { TVL_BANDS, categoryLabel, dateInfo, formatUsd } from '../lib/view.ts'
import { IconArrow, IconBook, IconSearch, IconSort } from '../components/Icons.tsx'
import { DataFlag, Info, MultiSelect, ProtocolAvatar, SourceMark } from '../components/UI.tsx'

type Dir = 'asc' | 'desc'

const tvlLabel = metricById('tvl')?.name ?? 'DefiLlama · Ethereum TVL'

const defaultDir = (key: string): Dir => (key === 'name' ? 'asc' : 'desc')

/**
 * The dashboard: rows are protocol versions, columns are feeds, and a cell says
 * one thing — whether that feed publishes data about that version.
 *
 * Versions are collected separately because the sources file them separately
 * (Aave v3 and v4, Uniswap v2/v3/v4), and they are only nested under a shared
 * name for reading. There is no value in the table on purpose: one feed grades
 * a protocol, another the vaults inside it, so their values are not comparable
 * side by side. They live one click away, in each feed's own words.
 */
export const MatrixPage = ({ index }: { index: IndexBundle }) => {
  const [params, setParams] = useSearchParams()
  const [hidden, setHidden] = useState<string[]>(readHiddenFeeds)

  const q = params.get('q') ?? ''
  const cat = params.get('category') ?? ''
  const tvl = params.get('tvl') ?? ''
  const availability = params.get('coverage') ?? ''
  const pinned = params.get('feed') ?? ''
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const feedIds = allFeeds.map((feed) => feed.id)
  const selectedIds = feedIds.includes(pinned)
    ? [pinned]
    : feedIds.filter((id) => !hidden.includes(id))
  const visibleFeeds = allFeeds.filter((feed) => selectedIds.includes(feed.id))
  const selectFeeds = (ids: string[]) => {
    const next = feedIds.filter((id) => !ids.includes(id))
    setHidden(next)
    writeHiddenFeeds(next)
    if (pinned) update('feed', '')
  }

  const requested = params.get('sort') ?? 'tvl'
  const sort =
    requested.startsWith('feed:') && !selectedIds.includes(requested.slice(5)) ? 'tvl' : requested
  const dir: Dir =
    params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : defaultDir(sort)
  const setSort = (key: string, nextDir: Dir) => {
    const next = new URLSearchParams(params)
    next.set('sort', key)
    if (nextDir === defaultDir(key)) next.delete('dir')
    else next.set('dir', nextDir)
    setParams(next, { replace: true })
  }

  const all = useMemo(() => groupRows(index, () => true), [index])
  const categories = [...new Set(all.flatMap((g) => g.rows.map((r) => r.protocol.category)))].sort()

  const groups = useMemo(() => {
    const band = TVL_BANDS[tvl]
    const filtered = groupRows(index, (row) => {
      const { protocol } = row
      const name = `${protocol.group ?? ''} ${protocol.name}`.toLowerCase()
      if (q.trim() && !name.includes(q.trim().toLowerCase())) return false
      if (cat && protocol.category !== cat) return false
      if (band && (row.tvl == null || row.tvl < band.min || row.tvl >= band.max)) return false
      // Coverage counts only the feeds currently selected: a hidden feed cannot leave a gap.
      if (availability && selectedIds.length) {
        const covered = dataCount(row.feeds, selectedIds)
        const full = covered === selectedIds.length
        if (availability === 'full' ? !full : full) return false
      }
      return true
    })

    const rank = (group: Group): number | null => {
      if (sort.startsWith('feed:')) return group.feeds[sort.slice(5)] ? 1 : 0
      if (sort === 'coverage') return dataCount(group.feeds, selectedIds)
      return group.tvl
    }
    return filtered.sort((a, b) => {
      if (sort === 'name') {
        return dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      }
      const [rankA, rankB] = [rank(a), rank(b)]
      if (rankA == null || rankB == null) {
        return rankA == null && rankB == null
          ? a.name.localeCompare(b.name)
          : rankA == null
            ? 1
            : -1
      }
      return (dir === 'desc' ? rankB - rankA : rankA - rankB) || a.name.localeCompare(b.name)
    })
  }, [index, q, cat, tvl, availability, sort, dir, selectedIds])

  const shown = groups.reduce((total, group) => total + group.rows.length, 0)
  const versions = all.reduce((total, group) => total + group.rows.length, 0)
  const withAnyData = all
    .flatMap((group) => group.rows)
    .filter((row) => dataCount(row.feeds, feedIds) > 0).length
  const active = q || cat || tvl || availability || pinned

  const columns = [
    { key: 'name', label: 'Protocol', desc: 'Z–A', asc: 'A–Z' },
    { key: 'tvl', label: tvlLabel, desc: 'high to low', asc: 'low to high' },
    ...visibleFeeds.map((feed) => ({
      key: `feed:${feed.id}`,
      label: feed.name,
      desc: 'with data first',
      asc: 'without data first',
    })),
    { key: 'coverage', label: 'Feeds', desc: 'most first', asc: 'fewest first' },
  ]

  const sortable = (key: string, content: ReactNode, className?: string, buttonClass = '') => (
    <th
      key={key}
      scope="col"
      className={className}
      aria-sort={sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={`th-sort${buttonClass && ` ${buttonClass}`}${sort === key ? ' sorted' : ''}`}
        onClick={() =>
          setSort(key, sort === key ? (dir === 'desc' ? 'asc' : 'desc') : defaultDir(key))
        }
      >
        {content}
        <IconSort dir={sort === key ? dir : null} />
      </button>
    </th>
  )

  /** A feed cell: the dot, linking to what that feed actually published. */
  const flag = (row: Row, feedId: string, feedName: string) => (
    <Link
      className="matrix-flag"
      to={`/protocol/${row.protocol.id}#feed-${feedId}`}
      aria-label={`${row.protocol.name}, ${feedName}: ${
        row.feeds[feedId] ? 'data available' : 'no data'
      }. Open the protocol.`}
    >
      <DataFlag has={row.feeds[feedId] === true} />
    </Link>
  )

  const versionRow = (row: Row, nested: boolean) => (
    <tr key={row.protocol.id} className={nested ? 'version-row' : undefined}>
      <th scope="row">
        <Link className="protocol-cell" to={`/protocol/${row.protocol.id}`}>
          {nested ? (
            <span className="version-tick" aria-hidden="true" />
          ) : (
            <ProtocolAvatar id={row.protocol.id} name={row.protocol.name} />
          )}
          <span>
            <strong>{row.protocol.name}</strong>
            <small>{categoryLabel(row.protocol.category)}</small>
          </span>
        </Link>
      </th>
      <td className="metric-column">
        <strong className="metric-value">{formatUsd(row.tvl) ?? '—'}</strong>
        <span className="cell-secondary">DefiLlama · Ethereum</span>
      </td>
      {visibleFeeds.map((feed) => (
        <td key={feed.id} className="flag-column">
          {flag(row, feed.id, feed.name)}
        </td>
      ))}
      <td className="coverage-column">
        {selectedIds.length > 0 ? (
          <span className="source-count">
            {dataCount(row.feeds, selectedIds)}
            <span> / {selectedIds.length}</span>
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td className="row-action">
        <Link to={`/protocol/${row.protocol.id}`} aria-label={`View ${row.protocol.name} details`}>
          <IconArrow />
        </Link>
      </td>
    </tr>
  )

  return (
    <div>
      <section className="home-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-square" /> NEUTRAL DEFI RISK AGGREGATOR
          </div>
          <h1>
            Which risk feed covers
            <br />
            <span>which protocol.</span>
          </h1>
          <p>
            Rows are protocol versions, columns are risk feeds.
            <br className="desktop-break" /> A green dot means that feed publishes data we could
            collect — open the version to read it, in the feed’s own words.
          </p>
          <Link className="text-link" to="/methodology">
            <IconBook /> How to read this table <IconArrow />
          </Link>
        </div>
        <div className="hero-summary">
          <div className="hero-summary-top">
            <span className="eyebrow">THE CURRENT PICTURE</span>
            <span className="outline-badge">Ethereum</span>
          </div>
          <div className="hero-numbers">
            <div>
              <strong>{versions}</strong>
              <span>protocol versions tracked</span>
            </div>
            <div>
              <strong>{allFeeds.length}</strong>
              <span>independent feeds</span>
            </div>
          </div>
          <div className="hero-summary-bottom">
            <span>
              <strong>
                {withAnyData} of {versions}
              </strong>{' '}
              have data from at least one feed
            </span>
            <Info label="What coverage tells you">
              This counts versions at least one feed publishes something about. More feeds mean more
              information, not a safer protocol — which is why sorting by it is a deliberate choice,
              not the default.
            </Info>
          </div>
        </div>
      </section>

      <section className="protocol-explorer" aria-labelledby="explorer-title">
        <div className="section-heading">
          <div>
            <h2 id="explorer-title">
              The matrix <span className="count-badge">{versions}</span>
            </h2>
            <p>
              Versions are collected separately and nested under their protocol. Open one to see
              what each feed actually published about it.
            </p>
          </div>
          <span className="section-aside">
            Every feed measures something different
            <Info label="Why there is no value here">
              A DeFiScan stage, a Risklayer 0-10 figure and a Philidor vault tier are not the same
              kind of statement, and a feed does not always say which slice of a protocol it looked
              at. The dashboard therefore reports only whether data exists; the values stay on the
              protocol page, unmixed.
            </Info>
          </span>
        </div>

        <div className="explorer-panel">
          <div className="explorer-toolbar">
            <label className="search-field">
              <IconSearch />
              <span className="sr-only">Search protocols</span>
              <input
                type="search"
                placeholder="Search protocols…"
                value={q}
                onChange={(e) => update('q', e.target.value)}
              />
              <span className="search-hint">{versions}</span>
            </label>
            <div className="toolbar-selects">
              <MultiSelect
                label="Risk feeds"
                selected={selectedIds}
                onChange={selectFeeds}
                summary={(ids, options) =>
                  ids.length === options.length
                    ? 'All risk feeds'
                    : ids.length === 0
                      ? 'No risk feeds'
                      : options
                          .filter((o) => ids.includes(o.id))
                          .map((o) => o.label)
                          .join(', ')
                }
                options={allFeeds.map((feed) => ({
                  id: feed.id,
                  label: feed.name,
                  hint: feed.topic,
                  mark: <SourceMark id={feed.id} />,
                  href: `/sources#feed-${feed.id}`,
                }))}
              />
              <label>
                <span className="sr-only">Filter by Ethereum TVL</span>
                <select value={tvl} onChange={(e) => update('tvl', e.target.value)}>
                  <option value="">Any TVL</option>
                  {Object.entries(TVL_BANDS).map(([id, band]) => (
                    <option key={id} value={id}>
                      {band.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by feed coverage</span>
                <select
                  value={availability}
                  disabled={selectedIds.length === 0}
                  onChange={(e) => update('coverage', e.target.value)}
                >
                  <option value="">Any coverage</option>
                  <option value="full">Every feed has data</option>
                  <option value="partial">Some feeds missing</option>
                </select>
              </label>
              <label className="sort-select">
                <span className="sr-only">Sort protocols</span>
                <select
                  value={`${sort}|${dir}`}
                  onChange={(e) => {
                    const [key = 'tvl', value = 'desc'] = e.target.value.split('|')
                    setSort(key, value as Dir)
                  }}
                >
                  {columns.flatMap((column) => [
                    <option key={`${column.key}|desc`} value={`${column.key}|desc`}>
                      {column.label}: {column.desc}
                    </option>,
                    <option key={`${column.key}|asc`} value={`${column.key}|asc`}>
                      {column.label}: {column.asc}
                    </option>,
                  ])}
                </select>
              </label>
            </div>
          </div>

          <div className="category-bar" role="group" aria-label="Protocol categories">
            <button
              className={!cat ? 'selected' : ''}
              aria-pressed={!cat}
              onClick={() => update('category', '')}
            >
              All protocols
            </button>
            {categories.map((category) => (
              <button
                key={category}
                className={cat === category ? 'selected' : ''}
                aria-pressed={cat === category}
                onClick={() => update('category', category)}
              >
                {categoryLabel(category)}
              </button>
            ))}
          </div>

          {groups.length > 0 ? (
            <>
              <div
                className="matrix-scroll"
                role="region"
                aria-label="Protocol coverage comparison"
                tabIndex={0}
              >
                <table className="risk-matrix">
                  <caption className="sr-only">
                    Which of {visibleFeeds.length} risk feeds publish data about {shown} protocol
                    versions. A green dot means data is available. Column headers sort the table.
                  </caption>
                  <thead>
                    <tr>
                      {sortable('name', 'Protocol')}
                      {sortable('tvl', tvlLabel, 'metric-column')}
                      {visibleFeeds.map((feed) =>
                        sortable(
                          `feed:${feed.id}`,
                          <>
                            <SourceMark id={feed.id} />
                            <span>
                              {feed.name}
                              <small>{feed.topic}</small>
                            </span>
                          </>,
                          'flag-column',
                          'source-head',
                        ),
                      )}
                      {sortable('coverage', 'Feeds', 'coverage-column')}
                      <th scope="col">
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) =>
                      group.rows.length === 1 && group.rows[0] ? (
                        versionRow(group.rows[0], false)
                      ) : (
                        <Fragment key={group.key}>
                          <tr className="group-row">
                            <th scope="row">
                              <span className="protocol-cell">
                                <ProtocolAvatar id={group.key} name={group.name} />
                                <span>
                                  <strong>{group.name}</strong>
                                  <small>{group.rows.length} versions tracked</small>
                                </span>
                              </span>
                            </th>
                            <td className="metric-column">
                              <strong className="metric-value">
                                {formatUsd(group.tvl) ?? '—'}
                              </strong>
                              <span className="cell-secondary">sum of the versions below</span>
                            </td>
                            {visibleFeeds.map((feed) => (
                              <td key={feed.id} className="flag-column">
                                <DataFlag
                                  has={group.feeds[feed.id] === true}
                                  label={`${group.name}, ${feed.name}: ${
                                    group.feeds[feed.id]
                                      ? 'data for at least one version'
                                      : 'no data for any version'
                                  }`}
                                />
                              </td>
                            ))}
                            <td className="coverage-column">
                              <span className="source-count muted">
                                {dataCount(group.feeds, selectedIds)}
                                <span> / {selectedIds.length}</span>
                              </span>
                            </td>
                            <td className="row-action" />
                          </tr>
                          {group.rows.map((row) => versionRow(row, true))}
                        </Fragment>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mobile-protocol-list">
                {groups.flatMap((group) =>
                  group.rows.map((row) => (
                    <article className="mobile-protocol" key={row.protocol.id}>
                      <div className="mobile-protocol-heading">
                        <Link to={`/protocol/${row.protocol.id}`} className="protocol-cell">
                          <ProtocolAvatar name={row.protocol.name} id={row.protocol.id} />
                          <span>
                            <strong>{row.protocol.name}</strong>
                            <small>{categoryLabel(row.protocol.category)}</small>
                          </span>
                        </Link>
                        <Link
                          className="icon-button"
                          to={`/protocol/${row.protocol.id}`}
                          aria-label={`View ${row.protocol.name} details`}
                        >
                          <IconArrow />
                        </Link>
                      </div>
                      <div className="mobile-metric">
                        <span>{tvlLabel}</span>
                        <strong>{formatUsd(row.tvl) ?? '—'}</strong>
                      </div>
                      <div className="mobile-assessments">
                        {visibleFeeds.map((feed) => (
                          <div key={feed.id}>
                            <span>{feed.name}</span>
                            {flag(row, feed.id, feed.name)}
                          </div>
                        ))}
                      </div>
                    </article>
                  )),
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <IconSearch />
              <h3>No matching protocols</h3>
              <p>Try another name, category, size or coverage.</p>
              <button className="button primary" onClick={() => setParams({})}>
                Clear filters
              </button>
            </div>
          )}

          <div className="table-footer">
            <span aria-live="polite">
              {shown} of {versions} versions
              {active && (
                <button className="text-button" onClick={() => setParams({})}>
                  Clear filters
                </button>
              )}
            </span>
            <span className="table-legend">
              <span>
                <DataFlag has /> data available
              </span>
              <span>
                <DataFlag has={false} /> no data
              </span>
            </span>
          </div>
        </div>

        <div className="below-table">
          <span>
            TVL snapshot: {dateInfo(index.generatedAt).label} · DefiLlama
            <Info label="About the size column">
              TVL is the Ethereum-mainnet figure DefiLlama publishes for that version. It is a
              measured quantity, not a safety rating, and it is never combined with what a feed
              says. A protocol row sums the versions nested under it.
            </Info>
          </span>
          <Link to="/sources" className="text-link">
            Meet the risk feeds <IconArrow />
          </Link>
        </div>
      </section>

      <section className="reading-strip">
        <div className="reading-strip-icon">
          <IconBook />
        </div>
        <div>
          <h2>A clearer view, without a single score.</h2>
          <p>
            Different feeds see different risks, and where two disagree we show both. Check the
            value, its scope and its date before drawing a conclusion.
          </p>
        </div>
        <Link to="/methodology" className="button secondary">
          Read the methodology <IconArrow />
        </Link>
      </section>
    </div>
  )
}
