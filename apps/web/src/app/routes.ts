/**
 * Header entries. `title` is the document title; the dashboard and a protocol
 * page name themselves, so they are absent here.
 */
export const NAV = [
  { to: '/', label: 'Protocols', end: true },
  { to: '/sources', label: 'Risk feeds', title: 'Risk feeds' },
  { to: '/methodology', label: 'How to read', title: 'How to read' },
  { to: '/changelog', label: 'What changed', title: 'What changed' },
] as const

export const pageTitle = (pathname: string): string | undefined => {
  const item = NAV.find((entry) => entry.to === pathname)
  return item && 'title' in item ? item.title : undefined
}
