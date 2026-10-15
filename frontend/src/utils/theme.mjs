export function readTheme(storage) {
  try {
    const value = (storage ?? globalThis.localStorage)?.getItem('fawterx_theme')
    return value === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function saveTheme(theme, storage) {
  try { (storage ?? globalThis.localStorage)?.setItem('fawterx_theme', theme) } catch { /* Preference storage is optional. */ }
}

export function nextTheme(theme) { return theme === 'dark' ? 'light' : 'dark' }

let transitionTimeout

export function startThemeTransition(event, { document: documentRef = globalThis.document, window: windowRef = globalThis.window } = {}) {
  const root = documentRef?.documentElement
  if (!root || windowRef?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const bounds = event?.currentTarget?.getBoundingClientRect?.()
  const width = windowRef?.innerWidth || 1
  const height = windowRef?.innerHeight || 1
  const x = bounds ? bounds.left + bounds.width / 2 : width / 2
  const y = bounds ? bounds.top + bounds.height / 2 : 48

  root.style.setProperty('--theme-transition-x', `${(x / width) * 100}%`)
  root.style.setProperty('--theme-transition-y', `${(y / height) * 100}%`)
  root.classList.remove('theme-transitioning')
  // Restart the short overlay animation when the user toggles rapidly.
  void root.offsetWidth
  root.classList.add('theme-transitioning')

  if (transitionTimeout) windowRef?.clearTimeout?.(transitionTimeout)
  transitionTimeout = windowRef?.setTimeout?.(() => {
    root.classList.remove('theme-transitioning')
    transitionTimeout = undefined
  }, 760)
}
