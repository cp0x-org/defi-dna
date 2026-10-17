import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useIndex } from '../data/useData.ts'
import { protocolById } from '../shared/lib/registry.ts'
import { Layout } from './Layout.tsx'
import { pageTitle } from './routes.ts'
import { DashboardPage } from '../features/dashboard/DashboardPage.tsx'
import { ProtocolPage } from '../features/protocol/ProtocolPage.tsx'
import { SourcesPage } from '../features/reading/SourcesPage.tsx'
import { MethodologyPage } from '../features/reading/MethodologyPage.tsx'
import { ChangelogPage } from '../features/reading/ChangelogPage.tsx'

/**
 * The dataset is not a gate. Everything hand-maintained — the registry, the
 * feeds, the methodology — renders without it; only the dashboard waits for it,
 * and says so instead of looking empty.
 */
export const App = () => {
  const { data: index, error, retry } = useIndex()
  const location = useLocation()

  useEffect(() => {
    const [, section, id = ''] = location.pathname.split('/')
    const page =
      (section === 'protocol' ? protocolById(id)?.name : undefined) ??
      pageTitle(location.pathname) ??
      'What every risk feed says about a DeFi protocol'
    document.title = `${page} · defi-dna`
  }, [location.pathname])

  return (
    <Routes>
      <Route element={<Layout index={index} />}>
        <Route index element={<DashboardPage index={index} error={error} onRetry={retry} />} />
        <Route path="protocol/:id/:tab?/:feed?" element={<ProtocolPage index={index} />} />
        <Route path="sources" element={<SourcesPage index={index} />} />
        <Route path="methodology" element={<MethodologyPage index={index} />} />
        <Route path="changelog" element={<ChangelogPage index={index} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
