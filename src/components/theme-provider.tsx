'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { THEMES, type ThemeKey } from '@/lib/themes'

type ThemeContextValue = { theme: ThemeKey; setTheme: (theme: ThemeKey) => void }
const ThemeContext = createContext<ThemeContextValue | null>(null)

// Lives in the root layout, wrapping every route — not inside
// draggable-home-scene.tsx, where this used to live. That component only
// exists on the '/' route, so its own theme state was destroyed and
// recreated every time a visitor navigated away and back, and the fresh
// copy came from whatever the server last rendered for '/' — which,
// after a same-tab round trip through another route, can still reflect
// the theme from before a just-made Settings change: revalidatePath('/')
// (lib/actions/theme.ts) refreshes the server's own cache for that path,
// but Next's client-side Router Cache doesn't necessarily refetch on the
// very next visit, so the "fresh" prop on remount wasn't actually
// guaranteed fresh. Reported directly: switching to Noir, visiting
// another page, and coming back could silently reset the desk to
// Default instead of keeping Noir. This provider sits in the ROOT
// layout, which — unlike a single page's own component tree — survives
// client-side navigation between routes without unmounting, so once a
// visitor picks a theme this session, it survives every navigation
// after that regardless of what any individual page's own server props
// say. The <html data-theme>/--theme-* sync effect (moved here from
// draggable-home-scene.tsx) still runs on mount too, for the same
// "restore whatever <html> should show" reasoning as before — just from
// a state value that can no longer go stale out from under it.
export function ThemeProvider({ initialTheme, children }: { initialTheme: ThemeKey; children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeKey>(initialTheme)

  useEffect(() => {
    const t = THEMES[theme]
    document.documentElement.style.setProperty('--theme-accent', t.pointColor)
    document.documentElement.style.setProperty('--theme-bg', t.background)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
