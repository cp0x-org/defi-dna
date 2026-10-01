import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useIndex } from './hooks/useIndex.ts'
import { protocolById } from './lib/registry.ts'
import { Layout } from './components/Layout.tsx'
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

/**
 * The dataset is not a gate. Everything hand-maintained — the registry, the
 * feeds, the methodology — renders without it; only the matrix waits for it,
 * and says so instead of looking empty.
 */
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

  return (
    <Routes>
      <Route element={<Layout index={index} />}>
        <Route index element={<MatrixPage index={index} error={error} />} />
        <Route path="protocol/:id" element={<ProtocolPage />} />
        <Route path="sources" element={<SourcesPage index={index} />} />
        <Route path="methodology" element={<MethodologyPage index={index} />} />
        <Route path="changelog" element={<ChangelogPage index={index} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
