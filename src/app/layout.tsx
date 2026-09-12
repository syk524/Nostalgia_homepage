import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Noto_Sans_KR, Roboto, Chivo_Mono, Bebas_Neue, Playfair_Display } from 'next/font/google'
import localFont from 'next/font/local'
import Script from 'next/script'
import { SoundPlayer } from '@/components/sound-player/sound-player'
import { CustomCursor } from '@/components/custom-cursor'
import { ThemeProvider } from '@/components/theme-provider'
import { NavWithData } from '@/components/nav-with-data'
import { getUserTheme } from '@/lib/get-user-theme'
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

// Used only by the Noir theme's scattered/grain-distorted wordmark
// (noir-background.tsx) — its thin, high-contrast strokes match the
// reference design in a way none of the pair-selectable fonts above do.
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['italic', 'normal'],
  variable: '--font-playfair-display',
})

// The "serif" pair-font choice (see lib/fonts.ts) — used for both Korean
// and Latin text, no mixed-font fallback chain.
const chosunNm = localFont({
  src: './fonts/ChosunNm.ttf',
  variable: '--font-chosun-nm',
  display: 'swap',
})

// The bold weight of the same Chosun Myeongjo family as chosunNm above —
// a separate font file (not a `weight`/`style` variant on chosunNm's own
// localFont call), so it's its own selectable PAIR_FONTS entry rather
// than an alternate rendering of the "serif" one.
const chosunKm = localFont({
  src: './fonts/ChosunKm.ttf',
  variable: '--font-chosun-km',
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

// A variable font (its own "Angle" axis, per the source filename) — no
// weight/style variants declared here since PAIR_FONTS only ever renders
// it at the browser's own default instance rather than picking a
// specific point on that axis.
const tokAngle = localFont({
  src: './fonts/TOKAngle.ttf',
  variable: '--font-tok-angle',
  display: 'swap',
})

const kopubMedium = localFont({
  src: './fonts/KoPubWorldBatangMedium.ttf',
  variable: '--font-kopub-medium',
  display: 'swap',
})

const kopubLight = localFont({
  src: './fonts/KoPubWorldBatangLight.ttf',
  variable: '--font-kopub-light',
  display: 'swap',
})

const moonscythe = localFont({
  src: './fonts/MOONSCYTHE-Demo.otf',
  variable: '--font-moonscythe',
  display: 'swap',
})

const fantasyNarratives = localFont({
  src: './fonts/FantasyNarratives.otf',
  variable: '--font-fantasy-narratives',
  display: 'swap',
})

const janeAust = localFont({
  src: './fonts/JaneAust.ttf',
  variable: '--font-jane-aust',
  display: 'swap',
})

const starWars = localFont({
  src: './fonts/Starjedi.ttf',
  variable: '--font-star-wars',
  display: 'swap',
})

// The same face's hollow/outline variant — a separate PAIR_FONTS entry
// (below) rather than a font-weight/style variant of starWars above,
// since it's a genuinely different set of glyph outlines (a distinct
// .ttf), not a bold/italic face next/font/local could pick between.
const starWarsHollow = localFont({
  src: './fonts/StarjediHollow.ttf',
  variable: '--font-star-wars-hollow',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Nustalgio',
  description: '이제껏 받아 온 친애를 셀 수 없는 미지라고 생각했다.',
  // Most link-unfurling clients (Slack, Discord, KakaoTalk, iMessage)
  // read og:description specifically rather than falling back to the
  // plain <meta name="description"> above — without this the share
  // preview wouldn't reliably pick up the text at all.
  openGraph: {
    title: 'Nustalgio',
    description: '이제껏 받아 온 친애를 셀 수 없는 미지라고 생각했다.',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getUserTheme()

  return (
    <html
      lang="en"
      data-theme={theme.key}
      suppressHydrationWarning
      style={{ ['--theme-accent' as string]: theme.pointColor, ['--theme-bg' as string]: theme.background }}
    >
      <body
        className={`${notoSansKR.variable} ${roboto.variable} ${chivoMono.variable} ${bebasNeue.variable} ${playfairDisplay.variable} ${chosunNm.variable} ${chosunKm.variable} ${zaslia.variable} ${homuraMincho.variable} ${kmu80Sungkok.variable} ${ogRenaissance.variable} ${antroVectraBold.variable} ${kunstlerScript.variable} ${hotra.variable} ${popstar.variable} ${anomale.variable} ${tokAngle.variable} ${kopubMedium.variable} ${kopubLight.variable} ${moonscythe.variable} ${fantasyNarratives.variable} ${janeAust.variable} ${starWars.variable} ${starWarsHollow.variable} font-sans`}
        suppressHydrationWarning
      >
        {/* Adobe Fonts (Typekit) kit for Shigure (lib/fonts.ts) — unlike
            every other pair font, this one isn't a file we host ourselves;
            the kit script injects its own @font-face rules and toggles
            wf-loading/wf-inactive classes on <html> as it loads, which is
            why it needs to run this early (beforeInteractive) rather than
            as a normal deferred script. */}
        <Script id="adobe-fonts-shigure" strategy="beforeInteractive">
          {`
            (function(d) {
              var config = {
                kitId: 'dan3fpf',
                scriptTimeout: 3000,
                async: true
              },
              h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\\bwf-loading\\b/g,"")+" wf-inactive";},config.scriptTimeout),tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};s.parentNode.insertBefore(tk,s)
            })(document);
          `}
        </Script>
        <ThemeProvider initialTheme={theme.key} isGuest={theme.isGuest}>
          {/* Rendered once, here, alongside {children} rather than inside
              either app/page.tsx or (main)/layout.tsx (which each used to
              mount their own separate copy) — per nav.tsx's own "mounted
              once for the whole app" comment, which the two-copy setup
              was quietly violating: navigating between the home scene and
              any other page unmounted one Nav and mounted a fresh other,
              reported directly as the nav (and the login/account state in
              it) visibly reloading instead of just staying put. This
              spot, inside ThemeProvider — itself a plain Context.Provider
              with no DOM node of its own, and already documented as
              surviving client-side navigation without unmounting — is
              what actually makes this the one persistent instance.
              fallback={null} keeps this layout itself from having to
              await Nav's own data (see NavWithData's own comment for
              why that matters for app/loading.tsx). */}
          <Suspense fallback={null}>
            <NavWithData />
          </Suspense>
          {children}
        </ThemeProvider>
        <SoundPlayer />
        <CustomCursor />
      </body>
    </html>
  )
}
