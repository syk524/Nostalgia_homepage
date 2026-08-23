import type { Metadata } from 'next'
import { Noto_Sans_KR, Roboto, Chivo_Mono, Bebas_Neue } from 'next/font/google'
import localFont from 'next/font/local'
import { SoundPlayer } from '@/components/sound-player/sound-player'
import { CustomCursor } from '@/components/custom-cursor'
import './globals.css'

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
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
const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bebas-neue',
})

// The "serif" pair-font choice (see lib/fonts.ts) — used for both Korean
// and Latin text, no mixed-font fallback chain.
const chosunNm = localFont({
  src: './fonts/ChosunNm.ttf',
  variable: '--font-chosun-nm',
  display: 'swap',
})

const zaslia = localFont({
  src: './fonts/Zaslia.otf',
  variable: '--font-zaslia',
  display: 'swap',
})

const homuraMincho = localFont({
  src: './fonts/HomuraMincho.otf',
  variable: '--font-homura-mincho',
  display: 'swap',
})

const kmu80Sungkok = localFont({
  src: './fonts/KMU80Sungkok.ttf',
  variable: '--font-kmu80-sungkok',
  display: 'swap',
})

const ogRenaissance = localFont({
  src: './fonts/OGRenaissance.ttf',
  variable: '--font-og-renaissance',
  display: 'swap',
})

const antroVectraBold = localFont({
  src: './fonts/AntroVectraBold.otf',
  variable: '--font-antro-vectra-bold',
  display: 'swap',
})

const kunstlerScript = localFont({
  src: './fonts/KunstlerScript.ttf',
  variable: '--font-kunstler-script',
  display: 'swap',
})

const hotra = localFont({
  src: './fonts/Hotra-Demo.otf',
  variable: '--font-hotra',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Nustalgio',
  description: 'A place to keep and share what matters',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${notoSansKR.variable} ${roboto.variable} ${chivoMono.variable} ${bebasNeue.variable} ${chosunNm.variable} ${zaslia.variable} ${homuraMincho.variable} ${kmu80Sungkok.variable} ${ogRenaissance.variable} ${antroVectraBold.variable} ${kunstlerScript.variable} ${hotra.variable} font-sans`}
        suppressHydrationWarning
      >
        {children}
        <SoundPlayer />
        <CustomCursor />
      </body>
    </html>
  )
}
