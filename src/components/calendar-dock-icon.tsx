'use client'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// The dock's calendar app gets a live icon face instead of a generic
// glyph — a small rounded card reflecting today's actual date, the way
// a system calendar app icon does. Computed once from the viewer's own
// clock; if the tab is left open across midnight the face goes stale
// until the next reload, which is fine for a decorative icon.
export function CalendarDockIcon({ size }: { size: number }) {
  const today = new Date()

  return (
    <div
      className="rounded-lg bg-scroll-50 flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ width: size, height: size }}
    >
      {/* line-height:1 boxes reserve descender space a bold numeral
          never uses, so the geometrically-centered two-line stack
          reads as sitting a little low — a small upward nudge
          corrects the optical (not literal) center. */}
      <div className="flex flex-col items-center -translate-y-px">
        <span className="text-center font-sans text-[7px] font-semibold uppercase text-ember leading-none">
          {WEEKDAYS[today.getDay()]}
        </span>
        <span className="font-sans font-bold leading-none text-ink-900 mt-0.5" style={{ fontSize: size * 0.44 }}>
          {today.getDate()}
        </span>
      </div>
    </div>
  )
}
