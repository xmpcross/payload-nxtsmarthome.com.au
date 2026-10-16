'use client'

import { createContext, useCallback, useEffect, useState } from 'react'

/**
 * Theme state for the Ncmaz components (SwitchDarkMode etc.).
 *
 * Follows the site's existing convention rather than the template's: the
 * choice is stored as localStorage.theme = 'dark' | 'light', dark is the
 * default, and the inline script in app/layout.tsx applies it before first
 * paint. This provider only mirrors that state and toggles it.
 */
interface ThemeContextValue {
  isDarkMode: boolean
  toggleDarkMode: () => void
  themeDir: 'rtl' | 'ltr'
  setThemeDir: (value: 'rtl' | 'ltr') => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true)
  const [themeDir, setThemeDir] = useState<'rtl' | 'ltr'>('ltr')

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'))
  }, [])

  const toggleDarkMode = useCallback((): void => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }
    setIsDarkMode(next)
  }, [])

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, themeDir, setThemeDir }}>
      {children}
    </ThemeContext.Provider>
  )
}
