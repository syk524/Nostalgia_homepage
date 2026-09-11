export type ThemeKey = 'default' | 'noir' | 'illust'

// The 'default' key is unchanged (it's the profiles.theme column's own
// literal default value pre-migration-090, and what every theme===
// 'default' check across the app still compares against) — only its
// user-facing label changed, to "Sticker", matching what actually
// distinguishes it now that Noir is the default a new sign-up lands on:
// this is the one with the draggable grid/wordmark/sticker board, not
// "the default one" anymore. Order here is also the Settings picker's
// own order (Object.entries), so Noir listed first matches it being the
// one new users actually see first.
//
// 'illust' (label "Illust") is Noir duplicated into its own theme, per
// direct request — same background/pointColor, and (see NOIR_LIKE below)
// shares every [data-theme="noir"] CSS rule and noir-only component
// branch, so it renders identical to Noir everywhere except its own
// landing-page background (draggable-home-scene.tsx). profiles.theme has
// no DB check constraint (073's own comment: validated at the app layer
// against this registry), so adding it was purely this file plus the
// shared-selector/branch updates, no migration.
export const THEMES: Record<ThemeKey, { label: string; background: string; pointColor: string }> = {
  noir: { label: 'Noir', background: '#010101', pointColor: '#f1f1f1' },
  illust: { label: 'Illust', background: '#010101', pointColor: '#f1f1f1' },
  default: { label: 'Sticker', background: '#f1f1f1', pointColor: '#2f2f2e' },
}

export function isThemeKey(value: string): value is ThemeKey {
  return value in THEMES
}

// Themes that share Noir's own component-level branches (the floating-
// particles overlay, etc. — CSS itself is handled by the shared
// :where([data-theme="noir"], [data-theme="illust"]) selectors in
// globals.css, not this). Every existing `theme === 'noir'` check across
// the app reads through this instead, so a future theme added to this
// list doesn't need each of those call sites touched individually.
export const NOIR_LIKE: ThemeKey[] = ['noir', 'illust']

export function isNoirLike(key: string): boolean {
  return (NOIR_LIKE as string[]).includes(key)
}
