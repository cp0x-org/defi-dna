import { useEffect, useRef } from 'react'
import { EMPTY_QUERY, TVL_MIN, UPDATED, type MatrixQuery } from '../lib/matrix.ts'
import { feeds } from '../lib/registry.ts'
import type { Row } from '../lib/rows.ts'
import { SIGNAL_LABELS, type Signal } from '../lib/status.ts'
import { categoryLabel } from '../lib/view.ts'
import { Prov, StatusDot } from './Coverage.tsx'
import { IconClose } from './Icons.tsx'

/** A row of mutually exclusive buttons. */
const Segmented = <T extends string | number>({
  label,
  value,
  options,
  onChange,
  small = false,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (value: T) => void
  small?: boolean
}) => (
  <div className={`seg${small ? ' sm' : ''}`} role="group" aria-label={label}>
    {options.map(([option, text]) => (
      <button
        key={String(option)}
        type="button"
        className={option === value ? 'on' : undefined}
        aria-pressed={option === value}
        onClick={() => onChange(option)}
      >
        {text}
      </button>
    ))}
  </div>
)

/**
 * Every filter on the dashboard, applied as it changes. Coverage filters ask
 * whether a feed has data; nothing here filters on what a feed says.
 */
export const FilterDrawer = ({
  open,
  query,
  rows,
  shown,
  onChange,
  onClose,
}: {
  open: boolean
  query: MatrixQuery
  rows: Row[]
  shown: number
  onChange: (query: MatrixQuery) => void
  onClose: () => void
}) => {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) close.current?.focus()
  }, [open])

  const set = (patch: Partial<MatrixQuery>) => onChange({ ...query, ...patch })
  const categories = [...new Set(rows.map((row) => row.protocol.category))].sort()
  const half = Math.ceil(feeds.length / 2)
  const feedSteps = [...new Set([1, half, feeds.length])].filter((step) => step > 0)

  return (
    <>
      {open ? <div className="scrim" onClick={onClose} /> : null}
      <aside
        className={`drawer${open ? ' open' : ''}`}
        id="filters"
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        aria-hidden={!open}
      >
        <div className="dr-head">
          <h2>Filters</h2>
          <span className="muted">applied live</span>
          <button
            ref={close}
            className="icon-btn"
            type="button"
            onClick={onClose}
            aria-label="Close filters"
          >
            <IconClose />
          </button>
        </div>
        <div className="dr-body">
          <section className="fs">
            <h3>
              Protocol <Prov kind="meta" />
            </h3>
            <div className="fl-label">Category</div>
            <div className="chipset">
              {categories.map((category) => (
                <label className="chk" key={category}>
                  <input
                    type="checkbox"
                    checked={query.categories.includes(category)}
                    onChange={(event) =>
                      set({
                        categories: event.target.checked
                          ? [...query.categories, category]
                          : query.categories.filter((other) => other !== category),
                      })
                    }
                  />
                  <span>
                    {categoryLabel(category)}{' '}
                    <em>{rows.filter((row) => row.protocol.category === category).length}</em>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="fs">
            <h3>
              Size <Prov kind="meta" />
            </h3>
            <div className="fl-label">
              TVL <span className="muted">DefiLlama · Ethereum</span>
            </div>
            <Segmented
              label="TVL"
              value={query.tvl}
              options={[
                ['', 'Any'],
                ...Object.entries(TVL_MIN).map(
                  ([key, band]) => [key, band.label] as [string, string],
                ),
              ]}
              onChange={(tvl) => set({ tvl })}
            />
          </section>

          <section className="fs">
            <h3>
              Coverage <Prov kind="cov" />
            </h3>
            <div className="fl-label">Feeds with data</div>
            <Segmented
              label="Feeds with data"
              value={query.feedsMin}
              options={[
                [0, 'Any'],
                ...feedSteps.map(
                  (step) =>
                    [step, step === feeds.length ? `All ${step}` : `≥ ${step}`] as [number, string],
                ),
              ]}
              onChange={(feedsMin) => set({ feedsMin })}
            />
          </section>

          <section className="fs">
            <h3>
              By feed <Prov kind="cov" />
            </h3>
            <p className="fs-note">
              Filters on whether a feed has published data about a version — never on what the feed
              says.
            </p>
            <div className="srcgrid">
              {feeds.map((feed) => {
                const covered = rows.filter((row) => row.feeds[feed.id]).length
                const value = query.has.includes(feed.id)
                  ? 'has'
                  : query.missing.includes(feed.id)
                    ? 'missing'
                    : ''
                return (
                  <div className="srcrow" key={feed.id}>
                    <span>
                      {feed.name}
                      <small>
                        data for {covered} of {rows.length} versions
                      </small>
                    </span>
                    <Segmented
                      small
                      label={feed.name}
                      value={value}
                      options={[
                        ['', 'Any'],
                        ['has', 'Has data'],
                        ['missing', 'No data'],
                      ]}
                      onChange={(next) =>
                        set({
                          has: [
                            ...query.has.filter((id) => id !== feed.id),
                            ...(next === 'has' ? [feed.id] : []),
                          ],
                          missing: [
                            ...query.missing.filter((id) => id !== feed.id),
                            ...(next === 'missing' ? [feed.id] : []),
                          ],
                        })
                      }
                    />
                  </div>
                )
              })}
            </div>
          </section>

          <section className="fs">
            <h3>
              Signals <Prov kind="src" />
            </h3>
            <p className="fs-note">
              Each feed’s own characterization, read from its own published scale.
            </p>
            {(['neg', 'neu', 'pos'] as Signal[]).map((signal) => (
              <label className="cb" key={signal}>
                <input
                  type="checkbox"
                  checked={query.signals.includes(signal)}
                  onChange={(event) =>
                    set({
                      signals: event.target.checked
                        ? [...query.signals, signal]
                        : query.signals.filter((other) => other !== signal),
                    })
                  }
                />
                <StatusDot tone={signal} />
                Has {SIGNAL_LABELS[signal].toLowerCase()} signals
              </label>
            ))}
          </section>

          <section className="fs">
            <h3>
              Incidents <Prov kind="src" />
            </h3>
            <label className="cb">
              <input
                type="checkbox"
                checked={query.incidents}
                onChange={(event) => set({ incidents: event.target.checked })}
              />
              Has incidents recorded by DefiLlama
            </label>
          </section>

          <section className="fs">
            <h3>
              Freshness <Prov kind="cov" />
            </h3>
            <div className="fl-label">
              Last change <span className="muted">in a feed’s published value</span>
            </div>
            <Segmented
              label="Last change"
              value={query.updated}
              options={[
                ['', 'Any'],
                ...Object.entries(UPDATED).map(
                  ([key, window]) => [key, window.label] as [string, string],
                ),
              ]}
              onChange={(updated) => set({ updated })}
            />
          </section>
        </div>
        <div className="dr-foot">
          <button
            className="btn ghost"
            type="button"
            onClick={() => onChange({ ...EMPTY_QUERY, q: query.q, sort: query.sort })}
          >
            Reset all
          </button>
          <button className="btn primary" type="button" onClick={onClose}>
            Show <span className="mono">{shown}</span>&nbsp;
            {shown === 1 ? 'version' : 'versions'}
          </button>
        </div>
      </aside>
    </>
  )
}
