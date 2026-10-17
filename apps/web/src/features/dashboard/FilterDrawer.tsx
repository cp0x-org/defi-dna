import { useEffect, useRef } from 'react'
import { TVL_MIN, UPDATED, keysOf, withoutFilters, type MatrixQuery } from './matrix.ts'
import { feeds } from '../../shared/lib/registry.ts'
import { coverageCount, type Row } from './rows.ts'
import { SIGNALS, SIGNAL_LABELS, SIGNAL_TONES } from '../../shared/lib/status.ts'
import { categoryLabel } from '../../shared/lib/view.ts'
import { Prov, StatusDot } from '../../shared/ui/Coverage.tsx'
import { IconClose } from '../../shared/ui/Icons.tsx'

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
  options: readonly (readonly [T, string])[]
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
  const panel = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)

  // A modal dialog: Tab stays inside while it is open, and focus returns to the
  // control that opened it. The closed panel is inert so it is not in the tab order.
  useEffect(() => {
    const node = panel.current
    if (!node) return
    // React 18's types don't know `inert`. Set it on the node: a closed dialog
    // must leave the tab order, and `inert={false}` can still leave the attribute on.
    if (!open) {
      node.setAttribute('inert', '')
      return
    }
    node.removeAttribute('inert')
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    close.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const root = panel.current
      if (!root) return
      const items = [
        ...root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((item) => item.tabIndex >= 0)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        event.preventDefault()
        return
      }
      const active = document.activeElement
      const inside = active instanceof Node && root.contains(active)
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      node.setAttribute('inert', '')
      if (returnTo && document.contains(returnTo)) returnTo.focus()
    }
  }, [open])

  const set = (patch: Partial<MatrixQuery>) => onChange({ ...query, ...patch })
  const categories = [...new Set(rows.map((row) => row.protocol.category))].sort()
  const half = Math.ceil(feeds.length / 2)
  const feedSteps = [...new Set([1, half, feeds.length])].filter((step) => step > 0)

  return (
    <>
      {open ? <div className="scrim" onClick={onClose} /> : null}
      <aside
        ref={panel}
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
                ...keysOf(TVL_MIN).map((key) => [key, TVL_MIN[key].label] as const),
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
                const covered = coverageCount(rows, feed.id)
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
            {SIGNALS.map((signal) => (
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
                <StatusDot tone={SIGNAL_TONES[signal]} />
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
                ...keysOf(UPDATED).map((key) => [key, UPDATED[key].label] as const),
              ]}
              onChange={(updated) => set({ updated })}
            />
          </section>
        </div>
        <div className="dr-foot">
          <button
            className="btn ghost"
            type="button"
            onClick={() => onChange(withoutFilters(query))}
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
