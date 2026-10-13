import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { safeUrl, sourceTone } from '../lib/view.ts'
import { IconExternal, IconInfo } from './Icons.tsx'

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

export const Info = ({
  label,
  children,
  icon = <IconInfo />,
}: {
  label: string
  children: ReactNode
  icon?: ReactNode
}) => {
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
        {icon}
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

/**
 * A card pinned under an element — or above it when there is no room below.
 * Mounted only while open, so it never renders on the server.
 */
export const Anchored = ({
  anchor,
  label,
  children,
  onMouseEnter,
  onMouseLeave,
}: {
  anchor: HTMLElement
  label: string
  children: ReactNode
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    const card = ref.current
    if (!card) return
    const rect = anchor.getBoundingClientRect()
    const below = rect.bottom + 6
    setStyle({
      left: Math.max(12, Math.min(rect.left - 6, window.innerWidth - card.offsetWidth - 12)),
      top:
        below + card.offsetHeight > window.innerHeight - 8
          ? Math.max(8, rect.top - card.offsetHeight - 6)
          : below,
    })
  }, [anchor])
  return (
    <div
      className="pop"
      role="dialog"
      aria-label={label}
      ref={ref}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
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

export const SourceMark = ({ id, large = false }: { id: string; large?: boolean }) => (
  <span
    className={`source-mark source-tone-${sourceTone(id)}${large ? ' large' : ''}`}
    aria-hidden="true"
  >
    {id.slice(0, 1).toUpperCase()}
  </span>
)

/** One field of a feed's record, labelled with the field it came from. */
export const Block = ({
  type,
  count,
  children,
}: {
  type: string
  count?: number
  children: ReactNode
}) => (
  <div className="blk">
    <div className="blk-type">
      {type}
      {count && count > 1 ? ` ×${count}` : ''}
    </div>
    <div className="blk-body">{children}</div>
  </div>
)

export const DataAgeHelp = () => (
  <Info label="About assessment dates">
    Dates belong to the feed’s own assessment, not to our last download. Amber marks a date more
    than 90 days old; it does not mean the assessment is invalid. Some reviews only change when the
    protocol does.
  </Info>
)
