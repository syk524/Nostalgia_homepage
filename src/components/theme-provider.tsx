'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { THEMES, isThemeKey, type ThemeKey } from '@/lib/themes'

type ThemeContextValue = { theme: ThemeKey; setTheme: (theme: ThemeKey) => void }
const ThemeContext = createContext<ThemeContextValue | null>(null)

// A guest has no profiles row to persist a theme choice to — without
// this, switching to Sticker as a guest would silently revert to the
// new Noir default (migration 090) on every fresh visit, since
// getUserTheme() has nothing else to go on for someone with no account.
// Signed-in users never touch this key: their choice already has a real
// home in profiles.theme, which is authoritative and shouldn't be
// second-guessed by a stale local value left over from some earlier
// session on the same browser.
const GUEST_THEME_KEY = 'guest-theme'

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
export function ThemeProvider({ initialTheme, isGuest, children }: { initialTheme: ThemeKey; isGuest: boolean; children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeKey>(initialTheme)

  // Corrects the server-rendered Noir default to whatever this guest
  // picked last time, if anything — runs once, after mount, since
  // localStorage isn't reachable during the server render that produced
  // initialTheme. That means a returning guest who chose Sticker briefly
  // sees Noir flash before this fires, same trade-off this codebase
  // already accepts elsewhere for other localStorage-backed defaults
  // (e.g. calendar-desk-widget.tsx's own open/closed state).
  useEffect(() => {
    if (!isGuest) return
    try {
      const saved = localStorage.getItem(GUEST_THEME_KEY)
      if (saved && isThemeKey(saved)) setTheme(saved)
    } catch {
      // Storage unavailable — just keeps the server-rendered Noir default.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = THEMES[theme]
    document.documentElement.style.setProperty('--theme-accent', t.pointColor)
    document.documentElement.style.setProperty('--theme-bg', t.background)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function handleSetTheme(next: ThemeKey) {
    setTheme(next)
    if (!isGuest) return
    try { localStorage.setItem(GUEST_THEME_KEY, next) } catch {
      // Storage unavailable — the switch still works, just won't be
      // remembered next visit.
    }
  }

  return <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
