'use client'
import { THEMES, type ThemeKey } from '@/lib/themes'
import { updateTheme } from '@/lib/actions/theme'

// A miniature of the actual landing page in each theme's own colors —
// not a generic swatch — so picking a theme here previews what it
// looks like there. Default gets the same 28px line grid the real
// scene draws (draggable-home-scene.tsx), just boosted from its real
// 0.05 opacity to something visible at this size; Noir gets a few
// static specks standing in for its particle field (noir-background.tsx)
// instead of the grid, matching that page's own "no grid on non-default
// themes" rule. The centered "N." mark is a simplified stand-in for the
// real multi-font wordmark image — full letter-by-letter reproduction
// doesn't survive being shrunk this far anyway.
function ThemeThumbnail({ themeKey }: { themeKey: ThemeKey }) {
  const t = THEMES[themeKey]
  const gridId = `theme-thumb-grid-${themeKey}`
  return (
    <svg viewBox="0 0 120 90" className="w-full h-auto block rounded-[5px]" aria-hidden="true">
      <rect width="120" height="90" fill={t.background} />
      {themeKey === 'default' ? (
        <>
          <defs>
            <pattern id={gridId} width="14" height="14" patternUnits="userSpaceOnUse">
              <path d="M 14 0 L 0 0 0 14" fill="none" stroke={t.pointColor} strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="120" height="90" fill={`url(#${gridId})`} opacity="0.16" />
        </>
      ) : (
        <g fill={t.pointColor} opacity="0.5">
          <circle cx="18" cy="20" r="0.8" />
          <circle cx="34" cy="12" r="0.6" />
          <circle cx="90" cy="18" r="0.7" />
          <circle cx="104" cy="30" r="0.5" />
          <circle cx="14" cy="62" r="0.6" />
          <circle cx="100" cy="66" r="0.8" />
          <circle cx="76" cy="76" r="0.5" />
          <circle cx="40" cy="72" r="0.6" />
        </g>
      )}
      <text
        x="60"
        y="49"
        textAnchor="middle"
        fill={t.pointColor}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="15"
        letterSpacing="0.5"
      >
        N<tspan fontSize="10">.</tspan>
      </text>
      {/* Dock-icon stand-ins — a bare hint that this is the desk scene,
          not just an abstract card. */}
      <g opacity="0.55">
        <rect x="50" y="66" width="7" height="7" rx="1.5" fill={t.pointColor} />
        <rect x="60.5" y="66" width="7" height="7" rx="1.5" fill={t.pointColor} />
      </g>
    </svg>
  )
}

// Click-and-apply thumbnails, replacing the earlier plain <select> now
// that there's more than a placeholder to show — the request's own
// original "later becomes a thumbnailed picker" framing. onThemeChange
// is the optimistic, instant local update (recolors the desk
// immediately); this component just fires the persist action alongside
// it, same as the select version did.
export function SettingsPanel({ theme, onThemeChange }: {
  theme: ThemeKey
  onThemeChange: (theme: ThemeKey) => void
}) {
  function handleSelect(next: ThemeKey) {
    if (next === theme) return
    onThemeChange(next)
    updateTheme(next)
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wide text-ink-400">
        Theme
      </span>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2">
        {Object.entries(THEMES).map(([key, t]) => {
          const active = key === theme
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleSelect(key as ThemeKey)}
              className={`group flex flex-col gap-1.5 rounded-md p-1 border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${active ? 'border-ink' : 'border-transparent'}`}
            >
              {/* Selection border lives on the button itself, in a fixed
                  ink color — not the theme's own point color, which for
                  Noir (near-white) would land right on top of this
                  always-light settings panel's own chrome and vanish. */}
              <div
                className="rounded-[5px] overflow-hidden border transition-colors group-hover:border-ink/20"
                style={{ borderColor: active ? 'transparent' : 'rgba(0,0,0,0.1)' }}
              >
                <ThemeThumbnail themeKey={key as ThemeKey} />
              </div>
              <span className={`font-mono text-[10px] uppercase tracking-wide ${active ? 'text-ink' : 'text-ink-400'}`}>
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
