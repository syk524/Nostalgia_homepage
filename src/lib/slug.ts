// Best-effort romanization so a non-Latin title (Korean, Japanese) still
// produces a plain-ASCII path — /profile/[slug] otherwise ends up carrying
// raw multi-byte characters, which broke navigation to that pair's page.
// Hangul romanizes exactly (its block is a closed algorithmic decomposition
// into initial/medial/final jamo); kana romanizes via a lookup table.
// Anything this can't place a Latin letter on (kanji, hanzi, other scripts)
// is dropped rather than left in the slug — slugify()'s fallback to "pair"
// (with uniqueSlug's -2/-3 suffixing) covers a title that romanizes to
// nothing at all.

const HANGUL_BASE = 0xac00
const HANGUL_LAST = 0xd7a3
const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
const JONG = ['', 'g', 'kk', 'gs', 'n', 'nj', 'nh', 'd', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h']

function romanizeHangul(codePoint: number): string {
  const index = codePoint - HANGUL_BASE
  const cho = Math.floor(index / (21 * 28))
  const jung = Math.floor((index % (21 * 28)) / 28)
  const jong = index % 28
  return CHO[cho] + JUNG[jung] + JONG[jong]
}

const HIRAGANA_MAP: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'wi', ゑ: 'we', を: 'wo', ん: 'n',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
}

// Katakana mirrors hiragana at a fixed +0x60 code-point offset for every
// character in this table, so the map is generated rather than repeated.
const KANA_MAP: Record<string, string> = { ...HIRAGANA_MAP }
for (const [kana, romaji] of Object.entries(HIRAGANA_MAP)) {
  KANA_MAP[String.fromCodePoint(kana.codePointAt(0)! + 0x60)] = romaji
}

// き + ゃ = "kya" — base consonant stem (minus its trailing い/i) for each
// kana that combines with a small や/ゆ/よ, hiragana and katakana alike.
const YOON_STEM: Record<string, string> = {}
for (const [base, stem] of Object.entries({ き: 'ky', ぎ: 'gy', し: 'sh', じ: 'j', ち: 'ch', ぢ: 'j', に: 'ny', ひ: 'hy', び: 'by', ぴ: 'py', み: 'my', り: 'ry' })) {
  YOON_STEM[base] = stem
  YOON_STEM[String.fromCodePoint(base.codePointAt(0)! + 0x60)] = stem
}
const YOON_SUFFIX: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o', ャ: 'a', ュ: 'u', ョ: 'o' }
const SOKUON = new Set(['っ', 'ッ']) // doubles the consonant that follows
const CHOON = new Set(['ー']) // repeats the preceding vowel

function transliterate(input: string): string {
  const chars = Array.from(input)
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const codePoint = c.codePointAt(0)!
    if (codePoint <= 0x7f) { out += c; continue }
    if (codePoint >= HANGUL_BASE && codePoint <= HANGUL_LAST) { out += romanizeHangul(codePoint); continue }
    if (SOKUON.has(c)) {
      const nextRomaji = KANA_MAP[chars[i + 1]]
      if (nextRomaji) out += nextRomaji[0]
      continue
    }
    if (CHOON.has(c)) {
      const lastVowel = out.match(/[aiueo](?=[^aiueo]*$)/)?.[0]
      if (lastVowel) out += lastVowel
      continue
    }
    const stem = YOON_STEM[c]
    const suffix = YOON_SUFFIX[chars[i + 1]]
    if (stem && suffix) { out += stem + suffix; i++; continue }
    const romaji = KANA_MAP[c]
    if (romaji) out += romaji
    // Anything else (kanji, hanzi, other scripts) has no deterministic
    // Latin reading available here, so it's dropped rather than kept raw.
  }
  return out
}

export function slugify(title: string): string {
  const base = transliterate(title)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return base || 'pair'
}
