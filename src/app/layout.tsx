import type { Metadata } from 'next'
import { Noto_Sans_KR, Roboto, Chivo_Mono, Bebas_Neue } from 'next/font/google'
import localFont from 'next/font/local'
import { SoundPlayer } from '@/components/sound-player/sound-player'
import { CustomCursor } from '@/components/custom-cursor'
import { createClient } from '@/lib/supabase/server'
import { THEMES, isThemeKey } from '@/lib/themes'
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

const popstar = localFont({
  src: './fonts/Popstar-Regular.otf',
  variable: '--font-popstar',
  display: 'swap',
})

const anomale = localFont({
  src: './fonts/ANOMALE-DEMO.otf',
  variable: '--font-anomale',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Nustalgio',
  description: 'A place to keep and share what matters',
}

// Reads the signed-in user's theme so nav, the auth forms, and list-view
// titles render with the right --theme-accent from first paint — a guest
// (or a user whose profile fetch fails) always gets 'default', same as
// the migration's own column default.
async function getUserTheme() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return THEMES.default

  const { data: profile } = await supabase.from('profiles').select('theme').eq('id', user.id).single()
  const theme = profile?.theme
  return isThemeKey(theme ?? '') ? THEMES[theme as keyof typeof THEMES] : THEMES.default
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getUserTheme()

  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{ ['--theme-accent' as string]: theme.pointColor, ['--theme-bg' as string]: theme.background }}
    >
      <body
        className={`${notoSansKR.variable} ${roboto.variable} ${chivoMono.variable} ${bebasNeue.variable} ${chosunNm.variable} ${zaslia.variable} ${homuraMincho.variable} ${kmu80Sungkok.variable} ${ogRenaissance.variable} ${antroVectraBold.variable} ${kunstlerScript.variable} ${hotra.variable} ${popstar.variable} ${anomale.variable} font-sans`}
        suppressHydrationWarning
      >
        {children}
        <SoundPlayer />
        <CustomCursor />
      </body>
    </html>
  )
}
