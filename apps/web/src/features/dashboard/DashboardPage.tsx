import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { IndexBundle } from '@defi-dna/data'
import { useChangelog, useMetrics } from '../../data/useData.ts'
import {
  SORTS,
  filterChips,
  matrixGroups,
  readQuery,
  withoutFilters,
  writeQuery,
  type MatrixQuery,
  type SortKey,
} from './matrix.ts'
import {
  COLUMNS,
  readCoverageView,
  readHiddenColumns,
  writeCoverageView,
  writeHiddenColumns,
  type ColumnKey,
  type CoverageView,
} from '../../shared/lib/prefs.ts'
import { feeds } from '../../shared/lib/registry.ts'
import { buildRows, changedWithinDay } from './rows.ts'
import {
  LEGEND_SIGNALS,
  SIGNAL_LABELS,
  SIGNAL_TONES,
  TONE_LABELS,
} from '../../shared/lib/status.ts'
import { CoverageBar, CoverageRing, Prov, StatusDot } from '../../shared/ui/Coverage.tsx'
import { FilterDrawer } from './FilterDrawer.tsx'
import { GroupRow } from './GroupRow.tsx'
import { MatrixHead } from './MatrixHead.tsx'
import { PopCard } from './PopCard.tsx'
import { POP_LABELS, usePopover } from './usePopover.ts'
import { VersionRow } from './VersionRow.tsx'
import { IconFilters, IconSearch } from '../../shared/ui/Icons.tsx'
import { LoadState } from '../../shared/ui/LoadState.tsx'
import { Anchored } from '../../shared/ui/UI.tsx'

/** The registry joined with nothing: names and categories without any collected fact. */
const NO_DATA: IndexBundle = { generatedAt: '', rows: [] }

const VIEWS: [CoverageView, string][] = [
  ['ring', 'Ring'],
  ['bar', 'Bar'],
  ['both', 'Compare'],
]

/**
 * Files read beside the index that did not arrive. Their columns stay empty
 * because of our failure, and the table says so instead of reading as "none".
 */
export const DataGaps = ({
  metricsError,
  changelogError,
  onRetry,
}: {
  metricsError: string | null
  changelogError: string | null
  onRetry: () => void
}) =>
  metricsError || changelogError ? (
    <div className="data-gaps" role="alert">
      <ul>
        {metricsError ? (
          <li>
            <b>DefiLlama’s incident figures could not be loaded</b>, and neither could the on-chain
            governance readings kept beside them. The Incidents, Timelock and Governance columns are
            empty because of our failure, not because DefiLlama records none or nothing was read.
          </li>
        ) : null}
        {changelogError ? (
          <li>
            <b>The run log could not be loaded.</b> The Updated column and the freshness filter have
            nothing to show until it is.
          </li>
        ) : null}
      </ul>
      <button className="text-btn" type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  ) : null

/**
 * The dashboard: one row per protocol version — its size, which feeds publish
 * data about it and how each characterizes it on its own scale, when a feed's
 * value last moved, and what DefiLlama records as incidents. A segment is
 * coloured only where the feed's own scale says how to read its value (see
 * lib/status.ts); data without such a reading is neutral, no data is grey.
 * The values themselves stay on the protocol page, in each feed's own words.
 */
export const DashboardPage = ({
  index,
  error,
  onRetry,
}: {
  index: IndexBundle | null
  error: string | null
  onRetry: () => void
}) => {
  const [params, setParams] = useSearchParams()
  const queryKey = params.toString()
  const query = useMemo(() => readQuery(new URLSearchParams(queryKey)), [queryKey])
  const setQuery = (next: MatrixQuery) => setParams(writeQuery(next), { replace: true })

  const metrics = useMetrics()
  const changelog = useChangelog()
  const [now] = useState(() => Date.now())
  const [view, setView] = useState<CoverageView>(readCoverageView)
  const [drawer, setDrawer] = useState(false)
  const [hidden, setHidden] = useState<Set<ColumnKey>>(readHiddenColumns)
  const [columnsMenu, setColumnsMenu] = useState<HTMLElement | null>(null)
  const columnsCard = useRef<HTMLDivElement | null>(null)
  const search = useRef<HTMLInputElement>(null)
  const { pop, cardRef, target, keepOpen, hideSoon, close } = usePopover(() => {
    setDrawer(false)
    setColumnsMenu(null)
  })

  const rows = useMemo(
    () => buildRows(index ?? NO_DATA, { metrics: metrics.data, changes: changelog.data }),
    [index, metrics.data, changelog.data],
  )
  const groups = useMemo(
    () => (index ? matrixGroups(rows, query, now) : []),
    [index, rows, query, now],
  )
  const shown = groups.reduce((total, group) => total + group.rows.length, 0)
  const chips = filterChips(query)
  const changedToday = rows.filter((row) => changedWithinDay(row, now).length > 0)
  const popRow = pop ? rows.find((row) => row.protocol.id === pop.protocolId) : undefined
  const noChangeTitle = changelog.error
    ? 'The run log could not be loaded'
    : changelog.data
      ? 'No change in our run log'
      : 'Loading the run log…'
  const noIncidentsTitle = metrics.error
    ? 'DefiLlama’s incident list could not be loaded'
    : metrics.data
      ? 'Not collected for this version'
      : 'Loading DefiLlama’s incident list…'
  const noGovernanceTitle = metrics.error
    ? 'The on-chain governance readings could not be loaded'
    : metrics.data
      ? 'Nothing read on-chain for this version'
      : 'Loading the on-chain governance readings…'

  // "/" jumps to the search, as on most data tables. Esc belongs to the popover.
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName ?? '')
      if (event.key === '/' && !typing) {
        event.preventDefault()
        search.current?.focus()
      }
    }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [])

  // The column picker closes on a click anywhere else; the cards are closed while it is open.
  useEffect(() => {
    if (!columnsMenu) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!columnsMenu.contains(target) && !columnsCard.current?.contains(target)) {
        setColumnsMenu(null)
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [columnsMenu])

  const chooseView = (next: CoverageView) => {
    setView(next)
    writeCoverageView(next)
  }

  const show = (key: ColumnKey) => !hidden.has(key)
  const toggleColumn = (key: ColumnKey, shown: boolean) => {
    const next = new Set(hidden)
    if (shown) next.delete(key)
    else next.add(key)
    setHidden(next)
    writeHiddenColumns(next)
  }

  const rowProps = {
    now,
    noChangeTitle,
    noIncidentsTitle,
    noGovernanceTitle,
    popTarget: target,
    show,
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Protocols</h1>
          <p>
            What each risk feed publishes about a protocol version on Ethereum mainnet, with the
            feed named on every value. Colours are each feed’s own characterization, read from its
            own published scale — <strong>defi-dna does not rate protocols.</strong>
          </p>
        </div>
        <dl className="ph-stats">
          <div>
            <dt>Protocol versions</dt>
            <dd>{rows.length}</dd>
          </div>
          <div>
            <dt>Feeds connected</dt>
            <dd>{feeds.length}</dd>
          </div>
          <div>
            <dt>Changed in 24h</dt>
            <dd>{index && changelog.data ? changedToday.length : '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="panel" data-view={view}>
        <div className="toolbar">
          <label className="search">
            <IconSearch />
            <input
              ref={search}
              type="search"
              placeholder="Search protocols or categories"
              autoComplete="off"
              aria-label="Search protocols"
              value={query.q}
              onChange={(event) => setQuery({ ...query, q: event.target.value })}
            />
            <kbd>/</kbd>
          </label>
          <button
            className="btn"
            type="button"
            aria-expanded={drawer}
            aria-controls="filters"
            onClick={() => {
              close()
              setDrawer(true)
            }}
          >
            <IconFilters />
            Filters
            {chips.length > 0 ? <span className="badge">{chips.length}</span> : null}
          </button>
          <label className="sort">
            Sort
            <select
              value={query.sort}
              aria-label="Sort protocols"
              onChange={(event) => setQuery({ ...query, sort: event.target.value as SortKey })}
            >
              {Object.entries(SORTS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            type="button"
            aria-expanded={columnsMenu != null}
            aria-haspopup="dialog"
            onClick={(event) => {
              close()
              setColumnsMenu(columnsMenu ? null : event.currentTarget)
            }}
          >
            Columns
            {hidden.size > 0 ? <span className="badge">{hidden.size} hidden</span> : null}
          </button>
          <span className="result-count" aria-live="polite">
            {!index ? (
              'Data not loaded'
            ) : shown === rows.length ? (
              <>
                <strong>{rows.length}</strong> versions
              </>
            ) : (
              <>
                Showing <strong>{shown}</strong> of {rows.length}
              </>
            )}
          </span>
          <span className="spacer" />
          <div className="viewtoggle" role="group" aria-label="Coverage indicator style">
            <span>Coverage view</span>
            {VIEWS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={view === key ? 'on' : undefined}
                aria-pressed={view === key}
                onClick={() => chooseView(key)}
              >
                {key === 'ring' ? (
                  <CoverageRing states={['pos', 'neu', 'none', 'neg', 'none']} size={14} />
                ) : key === 'bar' ? (
                  <CoverageBar states={['pos', 'neu', 'none']} />
                ) : null}
                {label}
              </button>
            ))}
          </div>
        </div>

        {chips.length > 0 ? (
          <div className="chips-row">
            {chips.map((chip) => (
              <span className="fchip" key={chip.label}>
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove ${chip.label}`}
                  onClick={() => setQuery(chip.without)}
                >
                  ×
                </button>
              </span>
            ))}
            <button
              className="text-btn"
              type="button"
              onClick={() => setQuery(withoutFilters(query))}
            >
              Clear all
            </button>
          </div>
        ) : null}

        {index ? (
          <DataGaps
            metricsError={metrics.error}
            changelogError={changelog.error}
            onRetry={() => {
              if (metrics.error) metrics.retry()
              if (changelog.error) changelog.retry()
            }}
          />
        ) : null}

        <div className="table-scroll" role="region" aria-label="Protocol versions" tabIndex={0}>
          <table className="grid">
            <caption className="sr-only">
              {index
                ? `${shown} protocol versions: size, the governance timelock and the bodies that decide as read on-chain, which of ${feeds.length} risk feeds publish data about each and how each feed characterizes it, when a feed’s value last changed, and incidents recorded by DefiLlama.`
                : 'The table is empty: the dataset is not loaded.'}
            </caption>
            <MatrixHead query={query} onSort={(sort) => setQuery({ ...query, sort })} show={show} />
            <tbody>
              {groups.map((group) =>
                group.rows.length === 1 && group.rows[0] ? (
                  <VersionRow
                    key={group.rows[0].protocol.id}
                    row={group.rows[0]}
                    nested={false}
                    {...rowProps}
                  />
                ) : (
                  <Fragment key={group.key}>
                    <GroupRow
                      group={group}
                      now={now}
                      noChangeTitle={noChangeTitle}
                      noIncidentsTitle={noIncidentsTitle}
                      show={show}
                    />
                    {group.rows.map((row) => (
                      <VersionRow key={row.protocol.id} row={row} nested {...rowProps} />
                    ))}
                  </Fragment>
                ),
              )}
            </tbody>
          </table>
        </div>

        {!index ? (
          // The table stays empty and says why: an empty table must never read as "no risk found".
          <LoadState
            error={error}
            onRetry={onRetry}
            failed="The dataset could not be loaded"
            loading="Loading the latest collected data…"
            help={
              <p>
                Running locally? Copy the published data with <code>npm run pull</code>, or collect
                it with <code>npm run refresh</code>.
              </p>
            }
          >
            The table stays empty until it is. An empty table here means no data, not &ldquo;no risk
            found&rdquo;.
          </LoadState>
        ) : groups.length === 0 ? (
          <div className="empty">
            <strong>No protocol versions match these filters.</strong>
            An empty result means nothing in our registry matches — not that a protocol is safe or
            unsafe.
            <div>
              {/* The search alone can empty the table, so this one clears it too. */}
              <button
                className="text-btn"
                type="button"
                onClick={() => setQuery({ ...withoutFilters(query), q: '' })}
              >
                {query.q ? 'Clear the search and all filters' : 'Clear all filters'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="table-foot">
          <div className="legend">
            <span className="lg-title">Feed status</span>
            {LEGEND_SIGNALS.map((signal) => (
              <span key={signal}>
                <StatusDot tone={SIGNAL_TONES[signal]} />
                {SIGNAL_LABELS[signal]}
              </span>
            ))}
            <span>
              <StatusDot tone="none" />
              {TONE_LABELS.none}
            </span>
            <span>
              — position on <b>each feed’s own published scale</b>. Data whose scale gives no
              reading is neutral. “No data” means the feed has not covered the version; it is not a
              signal.
            </span>
          </div>
          <div className="legend">
            <span className="lg-title">Provenance</span>
            <span>
              <Prov kind="meta" /> protocol facts from our registry, DefiLlama and the protocol’s
              governance contracts on Ethereum mainnet
            </span>
            <span>
              <Prov kind="cov" /> which feeds have data, and when it last changed
            </span>
            <span>
              <Prov kind="src" /> published by a named source, shown as-is — signals count feeds by
              their own characterization
            </span>
          </div>
          <div className="legend">
            <span className="lg-title">Segment order</span>
            <span>
              {feeds.map((feed, k) => `${k + 1} ${feed.name}`).join(' · ')} — same order in every
              row, clockwise from 12 o’clock in the ring.
            </span>
          </div>
        </div>
      </div>

      {columnsMenu ? (
        <Anchored anchor={columnsMenu} label="Columns" cardRef={columnsCard}>
          <div className="pop-h">
            <strong>Columns</strong>
          </div>
          <div className="pop-sub">
            Pick what the table shows. The protocol column always stays; the choice is kept in this
            browser.
          </div>
          <ul className="pop-list columns">
            {(Object.keys(COLUMNS) as ColumnKey[]).map((key) => (
              <li key={key}>
                <label className="cb">
                  <input
                    type="checkbox"
                    checked={show(key)}
                    onChange={(event) => toggleColumn(key, event.target.checked)}
                  />
                  {COLUMNS[key]}
                </label>
              </li>
            ))}
          </ul>
        </Anchored>
      ) : null}

      {pop && popRow ? (
        <Anchored
          anchor={pop.anchor}
          cardRef={cardRef}
          label={POP_LABELS[pop.kind]}
          onMouseEnter={keepOpen}
          onMouseLeave={() => {
            if (!pop.pinned) hideSoon()
          }}
        >
          <PopCard kind={pop.kind} row={popRow} pinned={pop.pinned} now={now} onClose={close} />
        </Anchored>
      ) : null}

      <FilterDrawer
        open={drawer}
        query={query}
        rows={rows}
        shown={index ? shown : 0}
        onChange={setQuery}
        onClose={() => setDrawer(false)}
      />
    </div>
  )
}
