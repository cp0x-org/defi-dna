import { useEffect, useRef, useState, type MouseEvent } from 'react'

export const POP_LABELS = {
  coverage: 'Feed coverage',
  signals: 'Feed signals',
  incidents: 'Incidents',
  changes: 'Recent changes',
} as const
export type PopKind = keyof typeof POP_LABELS

/** Which card is open. The row is read from the current rows, so a card never shows stale facts. */
export interface Popover {
  kind: PopKind
  protocolId: string
  anchor: HTMLElement
  pinned: boolean
}

/** Time to cross from a cell to its card, or to come back, before an unpinned card closes. */
const HIDE_DELAY = 350

export interface PopTarget {
  onMouseEnter: (event: MouseEvent<HTMLElement>) => void
  onMouseLeave: () => void
  onClick: (event: MouseEvent<HTMLElement>) => void
}

/**
 * The hover/pin card on the dashboard.
 *
 * Hover previews and a click pins. An unpinned card stays while the pointer is
 * on its cell or on the card, and closes a moment after it leaves both. A
 * pinned card stays until a click elsewhere, Esc or any scroll. The card is
 * reached through `cardRef` rather than a class selector, so renaming the
 * card's class cannot break the outside click.
 */
export const usePopover = (onEscape: () => void) => {
  const [pop, setPop] = useState<Popover | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const hideTimer = useRef<number | undefined>(undefined)
  // Read at event time: the page passes a fresh callback each render.
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  const close = () => setPop(null)

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setPop(null)
      onEscapeRef.current()
    }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [])

  // A pinned card stays until a click elsewhere; any card goes away on scroll.
  useEffect(() => {
    if (!pop) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!pop.anchor.contains(target) && !cardRef.current?.contains(target)) setPop(null)
    }
    const scroll = () => setPop(null)
    if (pop.pinned) document.addEventListener('pointerdown', outside)
    window.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [pop])

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
  const target = (kind: PopKind, protocolId: string): PopTarget => ({
    onMouseEnter: (event) => {
      keepOpen()
      if (!pop?.pinned) setPop({ kind, protocolId, anchor: event.currentTarget, pinned: false })
    },
    onMouseLeave: () => {
      if (!pop?.pinned) hideSoon()
    },
    onClick: (event) => {
      keepOpen()
      event.stopPropagation()
      const anchor = event.currentTarget
      setPop(
        pop?.pinned && pop.anchor === anchor ? null : { kind, protocolId, anchor, pinned: true },
      )
    },
  })

  return { pop, cardRef, target, keepOpen, hideSoon, close }
}
