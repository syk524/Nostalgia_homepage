'use client'
import { THEMES, type ThemeKey } from '@/lib/themes'
import { updateTheme } from '@/lib/actions/theme'

// Plain <select> for now — the request explicitly frames this as a first
// pass that later becomes a thumbnailed picker, so no need to build that
// UI yet. onThemeChange is the optimistic, instant local update (recolors
// the desk immediately); this component just fires the persist action
// alongside it.
export function SettingsPanel({ theme, onThemeChange }: {
  theme: ThemeKey
  onThemeChange: (theme: ThemeKey) => void
}) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as ThemeKey
    onThemeChange(next)
    updateTheme(next)
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <label className="font-mono text-[10px] uppercase tracking-wide text-ink-400" htmlFor="theme-select">
        Theme
      </label>
      <select
        id="theme-select"
        value={theme}
        onChange={handleChange}
        className="w-full px-2.5 py-1.5 rounded border border-ink/10 bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/30"
      >
        {Object.entries(THEMES).map(([key, t]) => (
          <option key={key} value={key}>{t.label}</option>
        ))}
      </select>
    </div>
  )
}
