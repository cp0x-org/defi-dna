import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useIndex } from './hooks/useIndex.ts'
import { protocolById } from './lib/registry.ts'
import { Layout } from './components/Layout.tsx'
import { DashboardPage } from './pages/DashboardPage.tsx'
import { ProtocolPage } from './pages/ProtocolPage.tsx'
import { SourcesPage } from './pages/SourcesPage.tsx'
import { MethodologyPage } from './pages/MethodologyPage.tsx'
import { ChangelogPage } from './pages/ChangelogPage.tsx'

const TITLES: Record<string, string> = {
  '/sources': 'Risk feeds',
  '/methodology': 'How to read',
  '/changelog': 'What changed',
}

/**
 * The dataset is not a gate. Everything hand-maintained — the registry, the
 * feeds, the methodology — renders without it; only the dashboard waits for it,
 * and says so instead of looking empty.
 */
export function App() {
  const { data: index, error } = useIndex()
  const location = useLocation()

  useEffect(() => {
    const [, section, id = ''] = location.pathname.split('/')
    const page =
      (section === 'protocol' ? protocolById(id)?.name : undefined) ??
      TITLES[location.pathname] ??
      'What every risk feed says about a DeFi protocol'
    document.title = `${page} · defi-dna`
  }, [location.pathname])

  return (
    <Routes>
      <Route element={<Layout index={index} />}>
        <Route index element={<DashboardPage index={index} error={error} />} />
        <Route path="protocol/:id/:tab?/:feed?" element={<ProtocolPage index={index} />} />
        <Route path="sources" element={<SourcesPage index={index} />} />
        <Route path="methodology" element={<MethodologyPage index={index} />} />
        <Route path="changelog" element={<ChangelogPage index={index} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
