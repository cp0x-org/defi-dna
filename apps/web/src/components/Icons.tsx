import type { ReactNode } from 'react'
const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)
export const IconMark = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M3 3h9v9H3zM16 3h9v9h-9zM3 16h9v9H3z" fill="currentColor" />
    <path d="M16 25v-9h9" stroke="currentColor" strokeWidth="3" />
  </svg>
)
export const IconSearch = () => (
  <Svg>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m16 16 5 5" />
  </Svg>
)
export const IconArrow = () => (
  <Svg>
    <path d="M4 12h16m-6-6 6 6-6 6" />
  </Svg>
)
export const IconExternal = () => (
  <Svg size={14}>
    <path d="M14 4h6v6m0-6L10 14M10 4H4v16h16v-6" />
  </Svg>
)
export const IconChevron = () => (
  <Svg size={16}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)
export const IconInfo = () => (
  <Svg size={16}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5m0-9h.01" />
  </Svg>
)
export const IconSort = ({ dir }: { dir: 'asc' | 'desc' | null }) => (
  <Svg size={14}>
    {dir === null ? (
      <path d="M8.5 10 12 6.2l3.5 3.8M8.5 14l3.5 3.8 3.5-3.8" />
    ) : dir === 'asc' ? (
      <path d="M12 19V5.5m-5.5 5.5L12 5.5l5.5 5.5" />
    ) : (
      <path d="M12 5v13.5m5.5-5.5L12 18.5 6.5 13" />
    )}
  </Svg>
)
export const IconClock = () => (
  <Svg size={14}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)
export const IconEthereum = () => (
  <Svg size={15}>
    <path d="m12 2 6 10-6 4-6-4 6-10Zm-6 13 6 7 6-7-6 4-6-4Z" />
  </Svg>
)
export const IconTheme = ({ dark }: { dark: boolean }) =>
  dark ? (
    <Svg>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </Svg>
  ) : (
    <Svg>
      <path d="M20 14a8.5 8.5 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z" />
    </Svg>
  )
export const IconBook = () => (
  <Svg>
    <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15" />
  </Svg>
)
