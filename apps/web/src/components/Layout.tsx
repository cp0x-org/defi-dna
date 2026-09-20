import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import type { IndexBundle } from '@defi-dna/data'
import { dateInfo } from '../lib/view.ts'
import { IconEthereum, IconMark, IconTheme } from './Icons.tsx'
import { ExternalLink } from './UI.tsx'

const REPO = 'https://github.com/cp0x-org/defi-dna'
const DATA_REPO = 'https://github.com/cp0x-org/defi-dna-data'

export const Layout = ({ index }: { index: IndexBundle }) => {
  const location = useLocation()
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('defi-dna-theme') !== 'light'
    } catch {
      return true
    }
  })

  useEffect(() => {
    document.documentElement.dataset['theme'] = dark ? 'dark' : 'light'
    try {
      localStorage.setItem('defi-dna-theme', dark ? 'dark' : 'light')
    } catch {
      /* Storage may be disabled. */
    }
  }, [dark])

  useEffect(() => {
    let target: HTMLElement | null = null
    try {
      target = location.hash
        ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
        : null
    } catch {
      /* Ignore malformed fragments. */
    }
    if (target) {
      target.scrollIntoView({ block: 'start' })
      target.focus({ preventScroll: true })
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.pathname, location.hash])

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand" aria-label="defi-dna home">
            <IconMark />
            <span>
              defi-dna<span className="brand-dot">.</span>
            </span>
          </Link>
          <nav className="primary-nav" aria-label="Main navigation">
            <NavLink to="/" end>
              Protocols
            </NavLink>
            <NavLink to="/sources">Risk feeds</NavLink>
            <NavLink to="/methodology">How to read</NavLink>
            <NavLink to="/changelog">What changed</NavLink>
          </nav>
          <div className="header-tools">
            <span className="network-label">
              <IconEthereum />
              Ethereum
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
            >
              <IconTheme dark={dark} />
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="page-container" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <Link to="/" className="brand small">
            <IconMark />
            <span>defi-dna.</span>
          </Link>
          <span>Every verdict belongs to the feed that published it. No composite score.</span>
        </div>
        <div className="footer-links">
          <Link to="/methodology">Methodology</Link>
          <ExternalLink href={DATA_REPO}>Open data</ExternalLink>
          <ExternalLink href={`${REPO}/blob/main/CHARTER.md`}>Charter</ExternalLink>
          <ExternalLink href={REPO}>GitHub · AGPL-3.0</ExternalLink>
        </div>
        <div className="footer-note">
          Data cut {dateInfo(index.generatedAt).label}. Individual assessment dates vary — always
          verify against the linked source before acting.
        </div>
      </footer>
    </div>
  )
}
