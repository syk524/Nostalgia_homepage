import { createClient } from '@/lib/supabase/server'
import { THEMES, isThemeKey, type ThemeKey } from '@/lib/themes'

// Reads the active theme — a signed-in user's own choice (profiles.theme,
// defaulting to 'noir' for a brand-new row as of migration 090) if
// they're logged in, otherwise 'noir' as the server-rendered guest
// default. isGuest tells ThemeProvider (theme-provider.tsx) whether it's
// safe to let a client-side localStorage preference override that
// default on mount — a guest with no account has nowhere else to
// remember an earlier "I switched to Sticker" choice, but a signed-in
// user's DB value here is already authoritative and shouldn't be
// second-guessed by a stale local value from some earlier session.
export async function getUserTheme(): Promise<{ key: ThemeKey; label: string; background: string; pointColor: string; isGuest: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { key: 'noir', ...THEMES.noir, isGuest: true }

  const { data: profile } = await supabase.from('profiles').select('theme').eq('id', user.id).single()
  const theme = profile?.theme
  const key = isThemeKey(theme ?? '') ? theme as ThemeKey : 'default'
  return { key, ...THEMES[key], isGuest: false }
}
