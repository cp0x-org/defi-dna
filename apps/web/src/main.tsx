import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { configureDataClient } from '@defi-dna/data'
import { App } from './app/App.tsx'
// Load order is the cascade: tokens, kit, the page sheets, the shared
// rules, then the reading pages.
import './styles/tokens.css'
import './styles/kit.css'
import './features/dashboard/dashboard.css'
import './features/protocol/protocol.css'
import './styles/base.css'
import './features/reading/reading.css'

/**
 * Hash routing on purpose: the app is a static bundle that must work from a
 * GitHub Pages project path and from an IPFS gateway without server rewrites.
 *
 * config.json says where the generated data is read from, at runtime.
 */
configureDataClient({ configUrl: `${import.meta.env.BASE_URL}config.json` })

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
