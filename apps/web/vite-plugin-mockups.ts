import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

/**
 * Publishes the standalone HTML mockups kept in /mokaps without linking them
 * from the app.
 *
 * A folder named `<anything>-v<N>` is served at `/mockup/v<N>/`, both by the dev
 * server and in the build output. Its entry is index.html, else dashboard.html,
 * else its first .html file; `/mockup/` lists every version. Pages are marked
 * noindex so an unreleased mockup does not end up in search results.
 */

const ROOT = fileURLToPath(new URL('../../mokaps/', import.meta.url))
const PREFIX = 'mockup'
const NOINDEX = '<meta name="robots" content="noindex, nofollow" />'
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

type Mockup = { version: string; name: string; entry: string }

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : entry.name.startsWith('.')
        ? []
        : [join(dir, entry.name)],
  )

const withNoindex = (html: string): string =>
  html.includes('name="robots"')
    ? html
    : html.replace(/<head[^>]*>/i, (tag) => `${tag}\n${NOINDEX}`)

const page = (title: string, body: string, head = ''): string =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${NOINDEX}
${head}<title>${title}</title>
<style>body{margin:0;padding:48px;font:15px/1.6 system-ui,sans-serif;background:#111c24;color:#e3edf2}a{color:#7bd1b7}li{margin:6px 0}code{color:#9fb1bd}</style>
</head>
<body>${body}</body>
</html>
`

/** Every published file, keyed by its path below /mockup/. */
export const mockupFiles = (): Map<string, string | Buffer> => {
  const files = new Map<string, string | Buffer>()
  if (!existsSync(ROOT)) return files
  const mockups: Mockup[] = []
  for (const folder of readdirSync(ROOT, { withFileTypes: true })) {
    const version = folder.isDirectory() ? /-(v\d+)$/.exec(folder.name)?.[1] : undefined
    if (!version || mockups.some((m) => m.version === version)) continue
    const dir = join(ROOT, folder.name)
    const paths = walk(dir).map((file) => relative(dir, file).split(sep).join('/'))
    const pages = paths.filter((path) => path.endsWith('.html') && !path.includes('/')).sort()
    const entry = ['index.html', 'dashboard.html'].find((name) => pages.includes(name)) ?? pages[0]
    if (!entry) continue
    mockups.push({ version, name: folder.name.slice(0, -version.length - 1), entry })
    for (const path of paths) {
      const content = readFileSync(join(dir, path))
      files.set(
        `${version}/${path}`,
        path.endsWith('.html') ? withNoindex(content.toString('utf8')) : content,
      )
    }
    if (entry !== 'index.html') {
      files.set(
        `${version}/index.html`,
        page(
          `defi-dna mockup ${version}`,
          `<a href="${entry}">${entry}</a>`,
          `<meta http-equiv="refresh" content="0; url=${entry}" />\n`,
        ),
      )
    }
  }
  mockups.sort((a, b) => Number(a.version.slice(1)) - Number(b.version.slice(1)))
  files.set(
    'index.html',
    page(
      'defi-dna mockups',
      `<h1>defi-dna mockups</h1><p>Unreleased UX explorations. Not linked from the site.</p><ul>${mockups
        .map((m) => `<li><a href="${m.version}/">${m.version}</a> — <code>${m.name}</code></li>`)
        .join('')}</ul>`,
    ),
  )
  return files
}

export const mockups = (): Plugin => ({
  name: 'defi-dna:mockups',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const root = `${server.config.base}${PREFIX}`
      const path = decodeURIComponent((req.url ?? '').split('?')[0] ?? '')
      // Relative links inside the pages need the trailing slash.
      if (path === root) {
        res.writeHead(301, { Location: `${root}/` }).end()
        return
      }
      if (!path.startsWith(`${root}/`)) return next()
      // Re-read on every request so edits to a mockup show up without a restart.
      const files = mockupFiles()
      const key = path.slice(root.length + 1)
      const file = files.get(key === '' || key.endsWith('/') ? `${key}index.html` : key)
      if (file === undefined && files.has(`${key}/index.html`)) {
        res.writeHead(301, { Location: `${path}/` }).end()
        return
      }
      // Answer here rather than fall through to the app's SPA fallback.
      if (file === undefined) {
        res.writeHead(404, { 'Content-Type': TYPES['.html'] ?? 'text/html' })
        res.end(
          page('Mockup not found', `<p>No such mockup. <a href="${root}/">All mockups</a></p>`),
        )
        return
      }
      res.writeHead(200, {
        'Content-Type': TYPES[extname(key) || '.html'] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      })
      res.end(file)
    })
  },
  generateBundle() {
    for (const [path, source] of mockupFiles()) {
      this.emitFile({ type: 'asset', fileName: `${PREFIX}/${path}`, source })
    }
  },
})
