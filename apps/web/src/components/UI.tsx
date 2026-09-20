import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { dateInfo, safeUrl, sourceTone } from '../lib/view.ts'
import { IconArrow, IconChevron, IconClock, IconExternal, IconInfo } from './Icons.tsx'

export const ExternalLink = ({
  href,
  children,
  className = 'text-link',
}: {
  href?: string | null
  children: ReactNode
  className?: string
}) => {
  const url = safeUrl(href)
  return url ? (
    <a className={className} href={url} target="_blank" rel="noreferrer noopener">
      {children}
      <IconExternal />
    </a>
  ) : (
    <span className="muted">{children}</span>
  )
}

export const Info = ({ label, children }: { label: string; children: ReactNode }) => {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 16, top: 16 })
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        ref.current?.querySelector('button')?.focus()
      }
    }
    const reposition = () => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      const popoverHeight =
        ref.current?.querySelector('.info-popover')?.getBoundingClientRect().height ?? 180
      const width = Math.min(310, window.innerWidth - 32)
      setPosition({
        left: Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16)),
        top:
          rect.bottom + popoverHeight + 16 > window.innerHeight
            ? Math.max(16, rect.top - popoverHeight - 8)
            : rect.bottom + 8,
      })
    }
    reposition()
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])
  return (
    <span
      className="info"
      ref={ref}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        className="info-button"
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <IconInfo />
      </button>
      {open && (
        <span className="info-popover" id={id} role="note" style={position}>
          <strong>{label}</strong>
          {children}
        </span>
      )}
    </span>
  )
}

export type MultiOption = {
  id: string
  label: string
  hint?: string
  mark?: ReactNode
  href?: string
}

/** Checkbox dropdown. Keeps its own open state; the selection lives with the caller. */
export const MultiSelect = ({
  label,
  options,
  selected,
  onChange,
  summary,
}: {
  label: string
  options: MultiOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  summary: (selected: string[], options: MultiOption[]) => string
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        ref.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  const toggle = (optionId: string) =>
    onChange(
      selected.includes(optionId)
        ? selected.filter((v) => v !== optionId)
        : options.filter((o) => o.id === optionId || selected.includes(o.id)).map((o) => o.id),
    )
  return (
    <div
      className="multiselect"
      ref={ref}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        type="button"
        className="multiselect-toggle"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="sr-only">{label}: </span>
        <span className="multiselect-label">{summary(selected, options)}</span>
        <span className="multiselect-count">
          {selected.length}/{options.length}
        </span>
        <IconChevron />
      </button>
      {open && (
        <div className="multiselect-panel" id={id} role="group" aria-label={label}>
          <div className="multiselect-head">
            <span>{label}</span>
            <span className="multiselect-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => onChange(options.map((o) => o.id))}
                disabled={selected.length === options.length}
              >
                All
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => onChange([])}
                disabled={selected.length === 0}
              >
                None
              </button>
            </span>
          </div>
          {options.map((o) => (
            <div className="multiselect-option" key={o.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(o.id)}
                  onChange={() => toggle(o.id)}
                />
                {o.mark}
                <span>
                  {o.label}
                  {o.hint && <small>{o.hint}</small>}
                </span>
              </label>
              {o.href && (
                <Link className="multiselect-link" to={o.href} aria-label={`About ${o.label}`}>
                  <IconArrow />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const ProtocolAvatar = ({
  name,
  id,
  large = false,
}: {
  name: string
  id: string
  large?: boolean
}) => {
  const color = [...id].reduce((n, char) => n + char.charCodeAt(0), 0) % 5
  return (
    <span className={`protocol-avatar avatar-${color}${large ? ' large' : ''}`} aria-hidden="true">
      {name
        .replace(/\s+(Finance|Protocol)$/i, '')
        .split(/\s+/)
        .map((s) => s[0])
        .join('')
        .slice(0, 2)}
    </span>
  )
}

export const SourceMark = ({ id }: { id: string }) => (
  <span className={`source-mark source-tone-${sourceTone(id)}`} aria-hidden="true">
    {id.slice(0, 1).toUpperCase()}
  </span>
)

export const AssessmentDate = ({
  value,
  compact = false,
}: {
  value?: string | null
  compact?: boolean
}) => {
  const date = dateInfo(value)
  return (
    <span className={`assessment-date${date.older ? ' older' : ''}`}>
      <IconClock />
      {date.label}
      {!compact && date.older && <span className="date-age">· {date.age}d old</span>}
    </span>
  )
}

export const DataAgeHelp = () => (
  <Info label="About assessment dates">
    Dates belong to the feed’s own assessment, not to our last download. Amber marks a date more
    than 90 days old; it does not mean the assessment is invalid. Some reviews only change when the
    protocol does.
  </Info>
)

/**
 * The dashboard's whole vocabulary: green when the feed has data for this
 * protocol, grey when it has none.
 *
 * No value is shown here on purpose. One feed grades a protocol, another grades
 * the vaults inside it — printing their values side by side would invite a
 * comparison none of them supports. The values live on the protocol page.
 */
export const DataFlag = ({ has, label }: { has: boolean; label?: string }) => {
  const dot = <span className={`data-dot${has ? ' filled' : ''}`} />
  return label ? (
    <span className="data-flag" role="img" aria-label={label} title={label}>
      {dot}
    </span>
  ) : (
    <span className="data-flag" aria-hidden="true">
      {dot}
    </span>
  )
}
