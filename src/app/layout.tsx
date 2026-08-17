import type { Metadata } from 'next'
import { Noto_Sans_KR, Roboto, Chivo_Mono, Playfair_Display, Bebas_Neue, Caveat } from 'next/font/google'
import localFont from 'next/font/local'
import { SoundPlayer } from '@/components/sound-player/sound-player'
import './globals.css'

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-kr',
})

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
})

const chivoMono = Chivo_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-chivo-mono',
})

// Selectable display fonts for character-pair titles/catchphrases/quotes
// (see lib/fonts.ts) — loaded globally here so the CSS variables exist
// regardless of which pair a page is rendering.
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-playfair-display',
})

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bebas-neue',
})

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-caveat',
})

// Companion Korean serif for the "serif" pair-font choice — Playfair
// Display has no Hangul glyphs, so it's listed first in that font-family
// stack (see lib/fonts.ts) and the browser falls back to this per-glyph
// automatically: Latin text renders in Playfair, Korean text in this,
// within the same string, with no extra logic needed.
const chosunNm = localFont({
  src: './fonts/ChosunNm.ttf',
  variable: '--font-chosun-nm',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Nostalgia',
  description: 'A place to keep and share what matters',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${notoSansKR.variable} ${roboto.variable} ${chivoMono.variable} ${playfairDisplay.variable} ${bebasNeue.variable} ${caveat.variable} ${chosunNm.variable} font-sans`}
        suppressHydrationWarning
      >
        {children}
        <SoundPlayer />
      </body>
    </html>
  )
}
