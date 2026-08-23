export type ThemeKey = 'default' | 'noir'

export const THEMES: Record<ThemeKey, { label: string; background: string; pointColor: string }> = {
  default: { label: 'Default', background: '#f1f1f1', pointColor: '#2f2f2e' },
  noir: { label: 'Noir', background: '#010101', pointColor: '#f1f1f1' },
}

export function isThemeKey(value: string): value is ThemeKey {
  return value in THEMES
}
