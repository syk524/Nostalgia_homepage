export type ThemeKey = 'default' | 'noir'

// The 'default' key is unchanged (it's the profiles.theme column's own
// literal default value pre-migration-090, and what every theme===
// 'default' check across the app still compares against) — only its
// user-facing label changed, to "Sticker", matching what actually
// distinguishes it now that Noir is the default a new sign-up lands on:
// this is the one with the draggable grid/wordmark/sticker board, not
// "the default one" anymore. Order here is also the Settings picker's
// own order (Object.entries), so Noir listed first matches it being the
// one new users actually see first.
export const THEMES: Record<ThemeKey, { label: string; background: string; pointColor: string }> = {
  noir: { label: 'Noir', background: '#010101', pointColor: '#f1f1f1' },
  default: { label: 'Sticker', background: '#f1f1f1', pointColor: '#2f2f2e' },
}

export function isThemeKey(value: string): value is ThemeKey {
  return value in THEMES
}
