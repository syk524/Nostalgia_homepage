'use client'
import Image from 'next/image'
import { pairFontFamily, pairFontWeight } from '@/lib/fonts'

// June 22, 2026 — the fixed reference date the "D+NN" count runs from,
// kept here (not in the day_counter table) since the user asked for a
// specific unmoving start date, not an editor-configurable one. Local
// calendar dates (not elapsed 24h periods), so D+0 is the reference day
// itself and D+1 is the very next calendar day, regardless of time zone
// or time-of-day.
const START_YEAR = 2026
const START_MONTH = 5 // 0-indexed: June
const START_DAY = 22

export function dayCount(): number {
  const now = new Date()
  const startUTC = Date.UTC(START_YEAR, START_MONTH, START_DAY)
  const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor((nowUTC - startUTC) / 86_400_000)
}

// The dock's day-counter icon gets a live face like the calendar's,
// instead of a generic glyph — a small card showing the current D+
// count. Computed once from the viewer's own clock; if the tab is left
// open across midnight the face goes stale until the next reload, same
// tradeoff as calendar-dock-icon.tsx. Background photo/font/text color
// mirror the same fields on the day_counter row (see
// day-counter-desk-widget.tsx, which passes them through) — the icon
// isn't independently customizable, it just reflects whatever the
// widget itself is currently set to.
export function DayCounterDockIcon({ size, photoUrl, font, textColor }: {
  size: number
  photoUrl?: string | null
  font?: string | null
  textColor?: string | null
}) {
  const n = dayCount()
  const color = textColor ?? '#FFFFFF'

  return (
    <div
      className="relative rounded-lg overflow-hidden select-none"
      style={{ width: size, height: size, background: '#282625' }}
    >
      {photoUrl && <Image src={photoUrl} alt="" fill sizes={`${size}px`} className="object-cover" />}
      {/* Same dark scrim the widget's own display face uses over its
          photo, so white text stays legible regardless of the image. */}
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full h-full flex flex-col items-center justify-center"
        style={{ fontFamily: pairFontFamily(font), fontWeight: pairFontWeight(font) }}
      >
        {/* Same optical-centering nudge as calendar-dock-icon.tsx. */}
        <div className="flex flex-col items-center -translate-y-px">
          <span className="text-[7px] font-semibold uppercase leading-none" style={{ color }}>D+</span>
          <span className="font-bold leading-none mt-0.5" style={{ fontSize: size * 0.32, color }}>
            {n}
          </span>
        </div>
      </div>
    </div>
  )
}
