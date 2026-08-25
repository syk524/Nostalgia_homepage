// Selectable fonts for a character pair's title/catchphrase/quote text.
// The actual font files are loaded once, globally, in app/layout.tsx via
// next/font/google (or next/font/local for ChosunNm) — this just maps a
// stored key to the resulting CSS variable, so a new pair only ever needs
// to persist a short string.
export const PAIR_FONTS = {
  default: { label: 'Default', family: 'var(--font-roboto), var(--font-noto-sans-kr), system-ui, sans-serif' },
  serif: { label: '조선명조체 (KR)', family: 'var(--font-chosun-nm), Georgia, serif' },
  serifBold: { label: '조선명조체 볼드 (KR)', family: 'var(--font-chosun-km), Georgia, serif' },
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
  anomale: { label: 'Anomale (Eng)', family: 'var(--font-anomale), sans-serif' },
  tokAngle: { label: 'Tok Angle (JP)', family: 'var(--font-tok-angle), sans-serif' },
  // Not self-hosted like the others — loaded from Adobe Fonts (Typekit
  // kit 'dan3fpf', see the <Script> in app/layout.tsx), so there's no
  // --font-* CSS variable here, just the family name the kit itself
  // registers. Confirmed live via document.fonts after the kit script
  // loads (kit-generated names aren't predictable from the display name
  // alone) — it's 'sictake-shigure', not 'shigure'.
  shigure: { label: 'Shigure (JP)', family: "'sictake-shigure', sans-serif" },
  // Same Typekit kit as Shigure — its config lists this family with two
  // static weight faces, 300 and 700, not a variable range, so a plain
  // fontFamily alone doesn't reliably land on 700: the CSS weight-
  // matching algorithm resolves an ambient, unstyled 400 to the nearer
  // 300 face, not 700, which would render this quietly as the wrong
  // (light) weight everywhere it's picked. weight: 700 here is what
  // makes pairFontWeight below actually force bold, per direct request.
  ahHakushu: { label: 'AH Hakushu (JP)', family: "'ah-hakushu-handwritten-font', sans-serif", weight: 700 },
  // Same kit, one static weight face (300) — no weight override needed,
  // same as every other single-face entry above.
  oonishi: { label: 'Oonishi (JP)', family: "'ta-oonishi', sans-serif" },
} as const

export type PairFontKey = keyof typeof PAIR_FONTS

export function pairFontFamily(key: string | null | undefined): string {
  return PAIR_FONTS[key as PairFontKey]?.family ?? PAIR_FONTS.default.family
}

// Only a few PAIR_FONTS entries need this — most are single-weight font
// files with nothing to disambiguate — so this is additive alongside
// pairFontFamily rather than merged into one return value: every
// existing call site keeps working unchanged, and only styles that
// actually care about a specific weight (currently just ahHakushu) need
// to also spread this in.
export function pairFontWeight(key: string | null | undefined): number | undefined {
  return (PAIR_FONTS[key as PairFontKey] as { weight?: number } | undefined)?.weight
}
