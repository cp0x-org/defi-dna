/**
 * Brand marks shipped under `assets/protocols` and `assets/feeds`.
 *
 * Filenames match a protocol or feed id (or its group stem): `aave.svg` covers
 * `aave-v3`, `aave-v4` and the dashboard group key `Aave`. A missing file keeps
 * the letter avatar / source mark as a fallback — e.g. risklayer today.
 */

const stemFromPath = (path: string): string => {
  const file = path.split('/').pop() ?? path
  return file.replace(/\.svg$/i, '').toLowerCase()
}

const indexIcons = (modules: Record<string, string>): Map<string, string> => {
  const map = new Map<string, string>()
  for (const [path, url] of Object.entries(modules)) {
    map.set(stemFromPath(path), url)
  }
  return map
}

const protocolIcons = indexIcons(
  import.meta.glob<string>('../../assets/protocols/*.svg', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
)

const feedIcons = indexIcons(
  import.meta.glob<string>('../../assets/feeds/*.svg', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
)

/**
 * Longest matching stem: `morpho-blue` → `morpho`, `Aave` → `aave`.
 * Exact id wins when a file is named for it.
 */
const resolveIcon = (icons: Map<string, string>, id: string): string | undefined => {
  let key = id.trim().toLowerCase()
  if (!key) return undefined
  if (icons.has(key)) return icons.get(key)
  const parts = key.split('-')
  while (parts.length > 1) {
    parts.pop()
    key = parts.join('-')
    if (icons.has(key)) return icons.get(key)
  }
  return undefined
}

export const protocolIconUrl = (id: string): string | undefined => resolveIcon(protocolIcons, id)

export const feedIconUrl = (id: string): string | undefined => resolveIcon(feedIcons, id)

/** Single-colour marks: inverted in dark theme so the dark SVG fill stays visible. */
export const FEED_MONOCHROME = new Set(['pigi', 'defipunkd'])
