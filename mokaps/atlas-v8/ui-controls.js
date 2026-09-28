// One control surface for the comparison hub and all concept pages.
;(() => {
  'use strict'

  const root = document.documentElement
  const modes = new Set(['real', 'demo14', 'demo24'])
  const modeLabels = [
    ['real', '3 actual', 'Three connected source feeds from the project snapshot'],
    ['demo14', '14 demo', 'Three connected feeds and eleven illustrative candidate names'],
    ['demo24', '24 demo', 'Three connected feeds and twenty-one illustrative names'],
  ]

  function readMode() {
    try {
      const saved = localStorage.getItem('dna_view_mode')
      if (modes.has(saved)) return saved
    } catch (_) {
      /* Storage may be disabled. */
    }
    return 'demo14'
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, value)
      return true
    } catch (_) {
      return false
    }
  }

  function mount() {
    const slot = document.querySelector('[data-dna-controls]')
    if (!slot) return

    const group = document.createElement('div')
    group.className = 'dna-controls'
    const modeGroup = document.createElement('div')
    modeGroup.className = 'dna-controls__modes'
    modeGroup.setAttribute('role', 'group')
    modeGroup.setAttribute('aria-label', 'Feed set')
    const label = document.createElement('span')
    label.className = 'dna-controls__label'
    label.textContent = 'Feeds'
    modeGroup.append(label)

    let selectedMode = readMode()
    for (const [mode, text, description] of modeLabels) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.dnaMode = mode
      button.setAttribute('aria-pressed', String(selectedMode === mode))
      button.title = description
      button.textContent = text
      button.addEventListener('click', () => {
        if (mode === selectedMode) return
        if (!save('dna_view_mode', mode)) {
          status.textContent = 'Feed preview cannot be saved in this browser.'
          return
        }
        window.dispatchEvent(
          new CustomEvent('dna:before-mode-change', { detail: { from: selectedMode, to: mode } }),
        )
        // Reload retains query and hash identifiers for protocol/version/feed.
        window.location.reload()
      })
      modeGroup.append(button)
    }

    const themeButton = document.createElement('button')
    themeButton.type = 'button'
    themeButton.className = 'dna-controls__theme'
    themeButton.dataset.dnaThemeToggle = ''
    themeButton.title = 'Toggle light and dark theme'
    themeButton.setAttribute('aria-label', 'Dark theme')
    function showTheme() {
      const dark = root.dataset.theme === 'dark'
      themeButton.setAttribute('aria-pressed', String(dark))
      themeButton.innerHTML = '<span aria-hidden="true">☾</span><span>Dark</span>'
    }
    themeButton.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
      root.dataset.theme = next
      root.style.colorScheme = next
      save('dna_theme', next)
      showTheme()
    })
    showTheme()

    const status = document.createElement('span')
    status.className = 'dna-controls__status'
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')

    group.append(modeGroup, themeButton, status)
    slot.replaceChildren(group)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true })
  } else {
    mount()
  }
})()
