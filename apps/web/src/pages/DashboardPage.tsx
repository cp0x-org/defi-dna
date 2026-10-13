import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { IndexBundle } from '@defi-dna/data'
import { useChangelog, useMetrics } from '../hooks/useIndex.ts'
import {
  EMPTY_QUERY,
  SORTS,
  filterChips,
  matrixGroups,
  readQuery,
  writeQuery,
  type MatrixQuery,
  type SortKey,
} from '../lib/matrix.ts'
import { readCoverageView, writeCoverageView, type CoverageView } from '../lib/prefs.ts'
import { feeds } from '../lib/registry.ts'
import { buildRows, changedAt, dataCount, type Group, type Row } from '../lib/rows.ts'
import {
  SIGNAL_LABELS,
  TONE_LABELS,
  signalCounts,
  signalOf,
  type Signal,
  type Tone,
} from '../lib/status.ts'
import { ageLabel, categoryLabel, dateInfo, formatUsd, timeLabel } from '../lib/view.ts'
import { CoverageBar, CoverageRing, Prov, StatusDot } from '../components/Coverage.tsx'
import { FilterDrawer } from '../components/FilterDrawer.tsx'
import { IconFilters, IconSearch } from '../components/Icons.tsx'
import { Anchored, ProtocolAvatar } from '../components/UI.tsx'

const DAY = 86_400_000
/** Time to cross from a cell to its card, or to come back, before an unpinned card closes. */
const HIDE_DELAY = 350
const feedIds = feeds.map((feed) => feed.id)

/** The registry joined with nothing: names and categories without any collected fact. */
const NO_DATA: IndexBundle = { generatedAt: '', rows: [] }

const VIEWS: [CoverageView, string][] = [
  ['ring', 'Ring'],
  ['bar', 'Bar'],
  ['both', 'Compare'],
]

/**
 * What stands in for the rows while the dataset is missing. The table stays
 * empty and says why: an empty table must never read as "no risk found".
 */
const DatasetState = ({ error }: { error: string | null }) =>
  error ? (
    <div className="empty-state" role="alert">
      <h3>The dataset could not be loaded</h3>
      <p>
        The table stays empty until it is. An empty table here means no data, not &ldquo;no risk
        found&rdquo;.
      </p>
      <button className="button primary" onClick={() => window.location.reload()}>
        Try again
      </button>
      <details>
        <summary>Technical details</summary>
        <p>{error}</p>
        <p>
          Running locally? Copy the published data with <code>npm run pull</code>, or collect it
          with <code>npm run refresh</code>.
        </p>
      </details>
    </div>
  ) : (
    <div className="empty-state" role="status">
      <h3>Loading the latest collected data…</h3>
      <div className="loading-track" />
    </div>
  )

const SIGNALS: Signal[] = ['neg', 'neu', 'pos']
const tonesOf = (row: Row): Tone[] => feeds.map((feed) => row.tones[feed.id] ?? 'none')

const POP_LABELS = {
  coverage: 'Feed coverage',
  signals: 'Feed signals',
  incidents: 'Incidents',
  changes: 'Recent changes',
} as const
type PopKind = keyof typeof POP_LABELS
interface Pop {
  kind: PopKind
  row: Row
  anchor: HTMLElement
  pinned: boolean
}

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
}: {
  index: IndexBundle | null
  error: string | null
}) => {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const query = readQuery(params)
  const setQuery = (next: MatrixQuery) => setParams(writeQuery(next), { replace: true })

  const metrics = useMetrics()
  const changelog = useChangelog()
  const [now] = useState(() => Date.now())
  const [view, setView] = useState<CoverageView>(readCoverageView)
  const [drawer, setDrawer] = useState(false)
  const [pop, setPop] = useState<Pop | null>(null)
  const search = useRef<HTMLInputElement>(null)
  const hideTimer = useRef<number | undefined>(undefined)

  const rows = useMemo(
    () => buildRows(index ?? NO_DATA, { metrics: metrics.data, changes: changelog.data }),
    [index, metrics.data, changelog.data],
  )
  const queryKey = params.toString()
  const groups = useMemo(
    () => (index ? matrixGroups(rows, readQuery(new URLSearchParams(queryKey)), now) : []),
    [index, rows, queryKey, now],
  )
  const shown = groups.reduce((total, group) => total + group.rows.length, 0)
  const chips = filterChips(query)
  const changedToday = rows.filter((row) => row.changes.some((c) => now - Date.parse(c.ts) <= DAY))

  // Esc closes whatever is open; "/" jumps to the search, as on most data tables.
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPop(null)
        setDrawer(false)
      }
      const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName ?? '')
      if (event.key === '/' && !typing) {
        event.preventDefault()
        search.current?.focus()
      }
    }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [])

  // A pinned card stays until a click elsewhere; any card goes away on scroll.
  useEffect(() => {
    if (!pop) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!pop.anchor.contains(target) && !document.querySelector('.pop')?.contains(target)) {
        setPop(null)
      }
    }
    const scroll = () => setPop(null)
    if (pop.pinned) document.addEventListener('pointerdown', outside)
    window.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [pop])

  // An unpinned card stays while the pointer is on its cell or on the card itself, and
  // closes a moment after it leaves both — long enough to move onto the card and read it.
  const keepOpen = () => window.clearTimeout(hideTimer.current)
  const hideSoon = () => {
    keepOpen()
    hideTimer.current = window.setTimeout(
      () => setPop((current) => (current?.pinned ? current : null)),
      HIDE_DELAY,
    )
  }
  useEffect(() => keepOpen, [])

  /** Hover previews, a click pins. The same facts are on the protocol page for keyboard and touch. */
  const popTarget = (kind: PopKind, row: Row) => ({
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      keepOpen()
      if (!pop?.pinned) setPop({ kind, row, anchor: event.currentTarget, pinned: false })
    },
    onMouseLeave: () => {
      if (!pop?.pinned) hideSoon()
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      keepOpen()
      event.stopPropagation()
      const anchor = event.currentTarget
      setPop(pop?.pinned && pop.anchor === anchor ? null : { kind, row, anchor, pinned: true })
    },
  })

  const chooseView = (next: CoverageView) => {
    setView(next)
    writeCoverageView(next)
  }

  const sortButton = (key: SortKey, label: string, alternate?: SortKey) => {
    const active = query.sort === key || query.sort === alternate
    return (
      <button
        type="button"
        className={`th-sort${active ? ' sorted' : ''}`}
        onClick={() =>
          setQuery({ ...query, sort: query.sort === key && alternate ? alternate : key })
        }
      >
        {label}{' '}
        <span className="arr" aria-hidden="true">
          {query.sort === alternate ? '↑' : active ? '↓' : '↕'}
        </span>
      </button>
    )
  }
  const ariaSort = (...keys: SortKey[]) =>
    keys.includes(query.sort)
      ? query.sort.endsWith('asc')
        ? ('ascending' as const)
        : ('descending' as const)
      : undefined

  const fresh = (changed: string | null) => {
    const age = changed ? now - Date.parse(changed) : null
    return (
      <span
        className={`fresh${age != null && age <= DAY ? ' recent' : ''}${
          age != null && age > 30 * DAY ? ' stale' : ''
        }`}
        title={changed ? `Last change ${timeLabel(changed)}` : 'No change in our run log'}
      >
        {ageLabel(changed, now) ?? '—'}
      </span>
    )
  }

  const versionRow = (row: Row, nested: boolean) => {
    const { protocol, incidents } = row
    const href = `/protocol/${protocol.id}`
    const states = tonesOf(row)
    const covered = dataCount(row.feeds, feedIds)
    const counts = signalCounts(states)
    const today = row.changes.filter((change) => now - Date.parse(change.ts) <= DAY)
    return (
      <tr
        key={protocol.id}
        className={nested ? 'version-row' : undefined}
        onClick={() => navigate(href)}
      >
        <td>
          <div className="pcell">
            {nested ? (
              <span className="vtick" aria-hidden="true" />
            ) : (
              <ProtocolAvatar id={protocol.id} name={protocol.name} />
            )}
            <span>
              <Link className="pname" to={href} onClick={(event) => event.stopPropagation()}>
                <strong>{protocol.name}</strong>
              </Link>
              {today.length > 0 ? (
                <button
                  type="button"
                  className="new"
                  aria-label={`${today.length} changes in the last 24 hours`}
                  {...popTarget('changes', row)}
                >
                  NEW · {today.length}
                </button>
              ) : null}
              <small className="mono">{protocol.id}</small>
            </span>
          </div>
        </td>
        <td>{categoryLabel(protocol.category)}</td>
        <td className="num">
          <span className="mono">{formatUsd(row.tvl) ?? '—'}</span>
          <small>Ethereum</small>
        </td>
        <td>
          <button
            type="button"
            className="hit"
            aria-label={`${covered} of ${feeds.length} feeds have data — show the list`}
            {...popTarget('coverage', row)}
          >
            <span className="v-ring">
              <CoverageRing states={states} />
            </span>
            <span className="v-bar">
              <CoverageBar states={states} />
            </span>
            <span className="cov-count">
              {covered}
              <span>/{feeds.length}</span>
            </span>
          </button>
        </td>
        <td>{fresh(changedAt(row))}</td>
        <td>
          <button
            type="button"
            className="hit sig"
            aria-label={`Feed signals: ${counts.neg} negative, ${counts.neu} neutral or informational, ${counts.pos} positive`}
            {...popTarget('signals', row)}
          >
            {SIGNALS.map((signal) => (
              <span key={signal} className={`sc ${signal}${counts[signal] ? '' : ' zero'}`}>
                <i />
                {counts[signal]}
              </span>
            ))}
          </button>
        </td>
        <td>
          {incidents == null ? (
            <span className="muted" title="Not collected for this version">
              —
            </span>
          ) : incidents.count === 0 ? (
            <span className="evt zero">0 recorded</span>
          ) : (
            <button type="button" className="hit" {...popTarget('incidents', row)}>
              <span>
                <span className="evt">{incidents.count} recorded</span>
                {incidents.latest ? (
                  <small>latest {dateInfo(incidents.latest.date).label}</small>
                ) : null}
              </span>
            </button>
          )}
        </td>
        <td className="go" aria-hidden="true">
          →
        </td>
      </tr>
    )
  }

  const groupRow = (group: Group) => {
    const categories = [...new Set(group.rows.map((row) => row.protocol.category))]
    return (
      <tr className="group-row" key={`group-${group.key}`}>
        <td>
          <div className="pcell">
            <ProtocolAvatar id={group.key} name={group.name} />
            <span>
              <strong>{group.name}</strong>
              <small>{group.rows.length} versions tracked</small>
            </span>
          </div>
        </td>
        <td>{categories.length === 1 ? categoryLabel(categories[0] ?? '') : 'Mixed'}</td>
        <td className="num">
          <span className="mono">{formatUsd(group.tvl) ?? '—'}</span>
          <small>sum of versions</small>
        </td>
        <td>
          {/* Versions can read differently in one feed; the group row shows only how many have data. */}
          <span className="cov-count" title="Feeds with data for at least one version">
            {dataCount(group.feeds, feedIds)}
            <span>/{feeds.length}</span>
            <small>any version</small>
          </span>
        </td>
        <td>{fresh(group.changedAt)}</td>
        <td />
        <td>
          {group.incidents == null ? (
            <span className="muted">—</span>
          ) : (
            <span className={`evt${group.incidents ? '' : ' zero'}`}>
              {group.incidents} recorded
              <small>across versions</small>
            </span>
          )}
        </td>
        <td />
      </tr>
    )
  }

  const popCard = (current: Pop): ReactNode => {
    const { row } = current
    const { protocol } = row
    const foot = (text: string, to: string, link: string) => (
      <div className="pop-f">
        <span>{current.pinned ? 'Esc to close' : text}</span>
        <Link to={to} onClick={() => setPop(null)}>
          {link}
        </Link>
      </div>
    )
    if (current.kind === 'coverage') {
      return (
        <>
          <div className="pop-h">
            <strong>{protocol.name}</strong>
            <span className="mono">
              {dataCount(row.feeds, feedIds)} / {feeds.length} feeds
            </span>
          </div>
          <div className="pop-sub">Status as each feed characterizes its own data</div>
          <ul className="pop-list">
            {feeds.map((feed) => {
              const tone = row.tones[feed.id] ?? 'none'
              return (
                <li key={feed.id} className={`st-${tone}`}>
                  <StatusDot tone={tone} />
                  <span>{feed.name}</span>
                  <em>{TONE_LABELS[tone]}</em>
                </li>
              )
            })}
          </ul>
          {foot('Click to pin', `/protocol/${protocol.id}/risk`, 'Risk intelligence →')}
        </>
      )
    }
    if (current.kind === 'signals') {
      return (
        <>
          <div className="pop-h">
            <strong>Feed signals · {protocol.name}</strong>
          </div>
          <div className="pop-sub">
            Feeds grouped by their own characterization. Not combined into a verdict.
          </div>
          {SIGNALS.map((signal) => {
            const members = feeds.filter(
              (feed) => signalOf(row.tones[feed.id] ?? 'none') === signal,
            )
            return members.length > 0 ? (
              <div key={signal}>
                <div className="pop-group">
                  {SIGNAL_LABELS[signal]} · {members.length}
                </div>
                <ul className="pop-list">
                  {members.map((feed) => {
                    const tone = row.tones[feed.id] ?? 'none'
                    return (
                      <li key={feed.id} className={`st-${tone}`}>
                        <StatusDot tone={tone} />
                        <span>{feed.name}</span>
                        <em>{TONE_LABELS[tone]}</em>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null
          })}
          {foot(
            `${dataCount(row.feeds, feedIds)} of ${feeds.length} feeds reporting`,
            `/protocol/${protocol.id}/risk`,
            'Read each feed →',
          )}
        </>
      )
    }
    if (current.kind === 'incidents') {
      const latest = row.incidents?.latest
      return (
        <>
          <div className="pop-h">
            <strong>Incidents · {protocol.name}</strong>
          </div>
          <div className="pop-body">
            <b>
              {row.incidents?.count} incident{row.incidents?.count === 1 ? '' : 's'}
            </b>{' '}
            recorded by <b>DefiLlama</b>.
            {latest ? ` Latest: ${dateInfo(latest.date).label}, “${latest.name}”.` : ''}
            <br />
            Listed as DefiLlama published them. defi-dna does not verify, classify or score
            incidents.
          </div>
          {foot('Source: DefiLlama', `/protocol/${protocol.id}/data`, 'Open incidents →')}
        </>
      )
    }
    const today = row.changes.filter((change) => now - Date.parse(change.ts) <= DAY)
    return (
      <>
        <div className="pop-h">
          <strong>
            {today.length} change{today.length === 1 ? '' : 's'} in the last 24h
          </strong>
        </div>
        <ul className="pop-list">
          {today.map((change, k) => (
            <li key={`${change.ts}-${change.feedId}-${k}`}>
              <span className="mono muted age">{ageLabel(change.ts, now)}</span>
              <span>
                <b>{feeds.find((feed) => feed.id === change.feedId)?.name ?? change.feedId}</b>{' '}
                {change.from === null ? 'published a first value' : 'changed its value'}
              </span>
            </li>
          ))}
        </ul>
        {foot('Moves in published values', `/protocol/${protocol.id}`, 'Latest changes →')}
      </>
    )
  }

  const head = (
    <thead>
      <tr className="grp">
        <th colSpan={3} className="g-meta">
          <Prov kind="meta">Protocol metadata</Prov>
          <span className="grp-note">registry · TVL via DefiLlama</span>
        </th>
        <th colSpan={2} className="g-cov">
          <Prov kind="cov">Data coverage</Prov>
          <span className="grp-note">facts about our collection, not the protocol</span>
        </th>
        <th colSpan={2} className="g-src">
          <Prov kind="src">Source-reported</Prov>
          <span className="grp-note">what sources published — not verified or scored by us</span>
        </th>
        <th />
      </tr>
      <tr className="cols">
        <th aria-sort={ariaSort('name-asc')}>{sortButton('name-asc', 'Protocol')}</th>
        <th>Category</th>
        <th className="num" aria-sort={ariaSort('tvl-desc', 'tvl-asc')}>
          {sortButton('tvl-desc', 'TVL', 'tvl-asc')}
        </th>
        <th aria-sort={ariaSort('coverage-desc')}>
          {sortButton('coverage-desc', 'Coverage')}
          <span className="th-sub">feeds with data · hover for the list</span>
        </th>
        <th aria-sort={ariaSort('updated-desc')}>
          {sortButton('updated-desc', 'Changed')}
          <span className="th-sub">latest move in a feed’s value</span>
        </th>
        <th aria-sort={ariaSort('signals-desc')}>
          {sortButton('signals-desc', 'Signals')}
          <span className="th-sub">negative · neutral/info · positive</span>
        </th>
        <th aria-sort={ariaSort('incidents-desc')}>
          {sortButton('incidents-desc', 'Incidents')}
          <span className="th-sub">recorded by DefiLlama</span>
        </th>
        <th>
          <span className="sr-only">Open</span>
        </th>
      </tr>
    </thead>
  )

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
              setPop(null)
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
              onClick={() => setQuery({ ...EMPTY_QUERY, q: query.q, sort: query.sort })}
            >
              Clear all
            </button>
          </div>
        ) : null}

        <div className="table-scroll" role="region" aria-label="Protocol versions" tabIndex={0}>
          <table className="grid">
            <caption className="sr-only">
              {index
                ? `${shown} protocol versions: size, which of ${feeds.length} risk feeds publish data about each and how each feed characterizes it, when a feed’s value last changed, and incidents recorded by DefiLlama.`
                : 'The table is empty: the dataset is not loaded.'}
            </caption>
            {head}
            <tbody>
              {groups.map((group) =>
                group.rows.length === 1 && group.rows[0] ? (
                  versionRow(group.rows[0], false)
                ) : (
                  <Fragment key={group.key}>
                    {groupRow(group)}
                    {group.rows.map((row) => versionRow(row, true))}
                  </Fragment>
                ),
              )}
            </tbody>
          </table>
        </div>

        {!index ? (
          <DatasetState error={error} />
        ) : groups.length === 0 ? (
          <div className="empty">
            <strong>No protocol versions match these filters.</strong>
            An empty result means nothing in our registry matches — not that a protocol is safe or
            unsafe.
            <div>
              <button className="text-btn" type="button" onClick={() => setParams({})}>
                Clear all filters
              </button>
            </div>
          </div>
        ) : null}

        <div className="table-foot">
          <div className="legend">
            <span className="lg-title">Feed status</span>
            <span>
              <StatusDot tone="pos" />
              Positive
            </span>
            <span>
              <StatusDot tone="neu" />
              Neutral / informational
            </span>
            <span>
              <StatusDot tone="neg" />
              Negative
            </span>
            <span>
              <StatusDot tone="none" />
              No data
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
              <Prov kind="meta" /> protocol facts from our registry and DefiLlama
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

      {pop ? (
        <Anchored
          anchor={pop.anchor}
          label={POP_LABELS[pop.kind]}
          onMouseEnter={keepOpen}
          onMouseLeave={() => {
            if (!pop.pinned) hideSoon()
          }}
        >
          {popCard(pop)}
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
