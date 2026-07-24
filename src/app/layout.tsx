import type { Metadata } from 'next'
import { Noto_Sans_KR, Roboto, Chivo_Mono } from 'next/font/google'
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

export const metadata: Metadata = {
  title: 'Nostalgia',
  description: 'A place to keep and share what matters',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${notoSansKR.variable} ${roboto.variable} ${chivoMono.variable} font-sans`}>
        {children}
        <SoundPlayer />
      </body>
    </html>
  )
}
