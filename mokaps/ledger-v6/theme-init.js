// Apply a saved theme before styles are loaded to avoid a flash on navigation.
;(() => {
  'use strict'

  const root = document.documentElement
  const pageDefault = root.dataset.defaultTheme === 'dark' ? 'dark' : 'light'
  let saved = null
  try {
    saved = localStorage.getItem('dna_theme')
  } catch (_) {
    /* Storage may be disabled. */
  }
  const theme = saved === 'light' || saved === 'dark' ? saved : pageDefault
  root.dataset.theme = theme
  root.style.colorScheme = theme
})()
