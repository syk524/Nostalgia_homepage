// Selectable fonts for a character pair's title/catchphrase/quote text.
// The actual font files are loaded once, globally, in app/layout.tsx via
// next/font/google (or next/font/local for ChosunNm) — this just maps a
// stored key to the resulting CSS variable, so a new pair only ever needs
// to persist a short string.
export const PAIR_FONTS = {
  default: { label: 'Default', family: 'var(--font-roboto), var(--font-noto-sans-kr), system-ui, sans-serif' },
  serif: { label: '조선명조체 (KR)', family: 'var(--font-chosun-nm), Georgia, serif' },
  display: { label: 'Bebas Neue (Eng)', family: 'var(--font-bebas-neue), sans-serif' },
  mono: { label: 'Chivo Mono (Eng)', family: 'var(--font-chivo-mono), ui-monospace, monospace' },
  zaslia: { label: 'Zaslia (Eng)', family: 'var(--font-zaslia), cursive' },
  homuraMincho: { label: 'Homura Mincho (JP)', family: 'var(--font-homura-mincho), serif' },
  kmu80Sungkok: { label: '국민대80주년 (KR)', family: 'var(--font-kmu80-sungkok), serif' },
  ogRenaissance: { label: 'OG 르네상스 비밀 (KR)', family: 'var(--font-og-renaissance), serif' },
  antroVectraBold: { label: 'Antro Vectra Bold (Eng)', family: 'var(--font-antro-vectra-bold), sans-serif' },
  kunstlerScript: { label: 'Kunstler Script (Eng)', family: 'var(--font-kunstler-script), cursive' },
  hotra: { label: 'Hotra (Eng)', family: 'var(--font-hotra), sans-serif' },
  popstar: { label: 'Popstar (Eng)', family: 'var(--font-popstar), sans-serif' },
} as const

export type PairFontKey = keyof typeof PAIR_FONTS

export function pairFontFamily(key: string | null | undefined): string {
  return PAIR_FONTS[key as PairFontKey]?.family ?? PAIR_FONTS.default.family
}
