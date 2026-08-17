// Selectable fonts for a character pair's title/catchphrase/quote text.
// The actual font files are loaded once, globally, in app/layout.tsx via
// next/font/google (or next/font/local for ChosunNm) — this just maps a
// stored key to the resulting CSS variable, so a new pair only ever needs
// to persist a short string.
export const PAIR_FONTS = {
  default: { label: 'Default', family: 'var(--font-roboto), var(--font-noto-sans-kr), system-ui, sans-serif' },
  // Playfair Display has no Hangul glyphs, so the browser's normal
  // per-glyph font fallback hands Korean characters to ChosunNm
  // automatically — no per-character logic needed, both fonts render
  // within the same string.
  serif: { label: '조선명조체', family: 'var(--font-playfair-display), var(--font-chosun-nm), Georgia, serif' },
  display: { label: 'Display (Bebas Neue)', family: 'var(--font-bebas-neue), sans-serif' },
  script: { label: 'Script (Caveat)', family: 'var(--font-caveat), cursive' },
  mono: { label: 'Mono (Chivo Mono)', family: 'var(--font-chivo-mono), ui-monospace, monospace' },
} as const

export type PairFontKey = keyof typeof PAIR_FONTS

export function pairFontFamily(key: string | null | undefined): string {
  return PAIR_FONTS[key as PairFontKey]?.family ?? PAIR_FONTS.default.family
}
