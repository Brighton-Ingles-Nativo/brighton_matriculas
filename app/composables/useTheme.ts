export const useTheme = () => {
  const isDark = useState('brighton-dark-mode', () => false)

  const applyTheme = (dark: boolean) => {
    isDark.value = dark
    if (import.meta.client) document.documentElement.classList.toggle('dark', dark)
  }

  const initTheme = () => {
    if (!import.meta.client) return
    const saved = window.localStorage.getItem('brighton-theme')
    applyTheme(saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches)
  }

  const toggleTheme = () => {
    const next = !isDark.value
    applyTheme(next)
    if (import.meta.client) window.localStorage.setItem('brighton-theme', next ? 'dark' : 'light')
  }

  return { isDark, initTheme, toggleTheme }
}
