import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type MutableRefObject,
} from 'react'
import { FEED_MONOCHROME, feedIconUrl, protocolIconUrl } from '../lib/icons.ts'
import { colourSlot, safeUrl } from '../lib/view.ts'
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

const INFO_OPEN_DELAY_MS = 200
const INFO_CLOSE_DELAY_MS = 100

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
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  const rootRef = useRef<HTMLSpanElement>(null)
  const popoverRef = useRef<HTMLSpanElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()

  const clearTimers = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current)
      openTimer.current = null
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const showSoon = useCallback(() => {
    clearTimers()
    openTimer.current = setTimeout(() => setOpen(true), INFO_OPEN_DELAY_MS)
  }, [clearTimers])

  const hideSoon = useCallback(() => {
    clearTimers()
    closeTimer.current = setTimeout(() => setOpen(false), INFO_CLOSE_DELAY_MS)
  }, [clearTimers])

  const hideNow = useCallback(() => {
    clearTimers()
    setOpen(false)
  }, [clearTimers])

  useEffect(() => clearTimers, [clearTimers])

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: 'hidden' })
      return
    }
    const place = () => {
      const trigger = rootRef.current
      const popover = popoverRef.current
      if (!trigger || !popover) return
      const rect = trigger.getBoundingClientRect()
      const width = Math.min(310, window.innerWidth - 32)
      const height = popover.offsetHeight
      setStyle({
        visibility: 'visible',
        left: Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16)),
        top:
          rect.bottom + height + 16 > window.innerHeight
            ? Math.max(16, rect.top - height - 8)
            : rect.bottom + 8,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hideNow()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, hideNow])

  return (
    <span
      className="info"
      ref={rootRef}
      onMouseEnter={showSoon}
      onMouseLeave={hideSoon}
      onFocus={showSoon}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) hideNow()
      }}
    >
      <button
        className="info-button"
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
      >
        {icon}
      </button>
      {open ? (
        <span className="info-popover" id={id} role="tooltip" ref={popoverRef} style={style}>
          <strong>{label}</strong>
          {children}
        </span>
      ) : null}
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
  cardRef,
}: {
  anchor: HTMLElement
  label: string
  children: ReactNode
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  /** So the owner can tell a click on the card from a click outside it. */
  cardRef?: MutableRefObject<HTMLDivElement | null>
}) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  const setRef = (node: HTMLDivElement | null) => {
    ref.current = node
    if (cardRef) cardRef.current = node
  }
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
      ref={setRef}
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
  const icon = protocolIconUrl(id)
  const initials = name
    .replace(/\s+(Finance|Protocol)$/i, '')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
  return (
    <span
      className={`protocol-avatar${icon ? ' has-icon' : ` avatar-${colourSlot(id)}`}${large ? ' large' : ''}`}
      aria-hidden="true"
    >
      {icon ? <img src={icon} alt="" /> : initials}
    </span>
  )
}

export const SourceMark = ({ id, large = false }: { id: string; large?: boolean }) => {
  const icon = feedIconUrl(id)
  const mono = Boolean(icon && FEED_MONOCHROME.has(id))
  return (
    <span
      className={`source-mark${icon ? ' has-icon' : ` source-tone-${colourSlot(id)}`}${large ? ' large' : ''}`}
      aria-hidden="true"
    >
      {icon ? (
        <img src={icon} alt="" className={mono ? 'mono' : undefined} />
      ) : (
        id.slice(0, 1).toUpperCase()
      )}
    </span>
  )
}

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

/** The three dates on these pages, named apart so none is mistaken for another. */
export const DataAgeHelp = () => (
  <Info label="About the dates">
    <b>Assessed</b> is the feed’s own date for its assessment, not our download. Amber marks a date
    more than 90 days old; it does not mean the assessment is invalid, some reviews only change when
    the protocol does. <b>Data cut</b> is when our pipeline last collected everything, and{' '}
    <b>Last read</b> when it last read this feed without a failure. <b>Changed</b> is when a value
    moved between two of our runs.
  </Info>
)
