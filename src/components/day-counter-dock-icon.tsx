'use client'

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
// tradeoff as calendar-dock-icon.tsx.
export function DayCounterDockIcon({ size }: { size: number }) {
  const n = dayCount()

  return (
    <div
      className="rounded-lg bg-scroll-50 flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ width: size, height: size }}
    >
      {/* Same optical-centering nudge as calendar-dock-icon.tsx. */}
      <div className="flex flex-col items-center -translate-y-px">
        <span className="font-mono text-[7px] font-semibold uppercase text-ember leading-none">D+</span>
        <span className="font-mono font-bold leading-none text-ink-900 mt-0.5" style={{ fontSize: size * 0.32 }}>
          {n}
        </span>
      </div>
    </div>
  )
}
