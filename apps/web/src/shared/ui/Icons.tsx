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
// A helix whose rungs are rows of separate dots: the feeds stand side by side and are
// never drawn as one bar. Same drawing as public/favicon.svg.
export const IconMark = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M24 3.5C24 11 8 10 8 16S24 21 24 28.5" opacity="0.45" />
    <g fill="currentColor" stroke="none">
      <circle cx="13" cy="6" r="1.35" />
      <circle cx="16" cy="6" r="1.35" />
      <circle cx="19" cy="6" r="1.35" />
      <circle cx="12" cy="16" r="1.5" />
      <circle cx="16" cy="16" r="1.5" />
      <circle cx="20" cy="16" r="1.5" />
      <circle cx="13" cy="26" r="1.35" />
      <circle cx="16" cy="26" r="1.35" />
      <circle cx="19" cy="26" r="1.35" />
    </g>
    <path d="M8 3.5C8 11 24 10 24 16S8 21 8 28.5" />
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
export const IconFilters = () => (
  <Svg size={15}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Svg>
)
export const IconClose = () => (
  <Svg>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
