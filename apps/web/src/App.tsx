import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useIndex } from './hooks/useIndex.ts'
import { protocolById } from './lib/registry.ts'
import { Layout } from './components/Layout.tsx'
import { IconMark } from './components/Icons.tsx'
import { MatrixPage } from './pages/MatrixPage.tsx'
import { ProtocolPage } from './pages/ProtocolPage.tsx'
import { SourcesPage } from './pages/SourcesPage.tsx'
import { MethodologyPage } from './pages/MethodologyPage.tsx'
import { ChangelogPage } from './pages/ChangelogPage.tsx'

const TITLES: Record<string, string> = {
  '/sources': 'Risk feeds',
  '/methodology': 'How to read the matrix',
  '/changelog': 'What changed',
}

export function App() {
  const { data: index, error } = useIndex()
  const location = useLocation()

  useEffect(() => {
    const id = location.pathname.startsWith('/protocol/')
      ? location.pathname.slice('/protocol/'.length)
      : ''
    const page =
      protocolById(id)?.name ??
      TITLES[location.pathname] ??
      'What every risk feed says about a DeFi protocol'
    document.title = `${page} · defi-dna`
  }, [location.pathname])

  if (error) {
    return (
      <main className="app-state">
        <IconMark />
        <h1>We couldn’t load the dataset.</h1>
        <p>
          Nothing is shown until the data is available — an empty table would read as &ldquo;no risk
          found&rdquo;, and it means no such thing.
        </p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Try again
        </button>
        <details>
          <summary>Technical details</summary>
          <p>{error}</p>
          <p>
            Running locally? Generate the data with <code>npm run refresh</code>.
          </p>
        </details>
      </main>
    )
  }

  if (!index) {
    return (
      <main className="app-state" role="status">
        <IconMark />
        <h1>Bringing the feeds together.</h1>
        <p>Loading the latest collected snapshot…</p>
        <div className="loading-track" />
      </main>
    )
  }

  return (
    <Routes>
      <Route element={<Layout index={index} />}>
        <Route index element={<MatrixPage index={index} />} />
        <Route path="protocol/:id" element={<ProtocolPage />} />
        <Route path="sources" element={<SourcesPage index={index} />} />
        <Route path="methodology" element={<MethodologyPage index={index} />} />
        <Route path="changelog" element={<ChangelogPage index={index} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
