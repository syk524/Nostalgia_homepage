import { createClient } from '@/lib/supabase/server'
import { THEMES, isThemeKey, type ThemeKey } from '@/lib/themes'

// Reads the signed-in user's theme — a guest (or a user whose profile
// fetch fails) always gets 'default', same as the migration's own
// column default. Returns the key alongside the resolved colors, for
// any server component that needs to know the active theme (root
// layout's <html data-theme>, and any page that conditionally renders
// Noir-only decoration like NoirParticleField).
export async function getUserTheme(): Promise<{ key: ThemeKey; label: string; background: string; pointColor: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { key: 'default', ...THEMES.default }

  const { data: profile } = await supabase.from('profiles').select('theme').eq('id', user.id).single()
  const theme = profile?.theme
  const key = isThemeKey(theme ?? '') ? theme as ThemeKey : 'default'
  return { key, ...THEMES[key] }
}
