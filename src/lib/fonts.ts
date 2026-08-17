// Selectable fonts for a character pair's title/catchphrase/quote text.
// The actual font files are loaded once, globally, in app/layout.tsx via
// next/font/google (or next/font/local for ChosunNm) — this just maps a
// stored key to the resulting CSS variable, so a new pair only ever needs
// to persist a short string.
export const PAIR_FONTS = {
  default: { label: 'Default', family: 'var(--font-roboto), var(--font-noto-sans-kr), system-ui, sans-serif' },
  serif: { label: '조선명조체', family: 'var(--font-chosun-nm), Georgia, serif' },
  display: { label: 'Display (Bebas Neue)', family: 'var(--font-bebas-neue), sans-serif' },
  script: { label: 'Cursive (Eng)', family: 'var(--font-bastliga-one), cursive' },
  mono: { label: 'Mono (Chivo Mono)', family: 'var(--font-chivo-mono), ui-monospace, monospace' },
  zaslia: { label: 'Zaslia (Eng)', family: 'var(--font-zaslia), cursive' },
  homuraMincho: { label: 'Homura Mincho (JP)', family: 'var(--font-homura-mincho), serif' },
  kmu80Sungkok: { label: '국민대80주년 (KR)', family: 'var(--font-kmu80-sungkok), serif' },
} as const

export type PairFontKey = keyof typeof PAIR_FONTS

export function pairFontFamily(key: string | null | undefined): string {
  return PAIR_FONTS[key as PairFontKey]?.family ?? PAIR_FONTS.default.family
}
