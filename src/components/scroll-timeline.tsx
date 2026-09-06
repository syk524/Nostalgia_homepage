'use client'
import { useEffect, useState } from 'react'

// A fixed number of evenly-spaced ticks along the scroll range, not one
// per message — a 650+ message log would make a per-message tick count
// unreadable, and there's no natural "section" boundary in an imported
// chat log to key ticks off instead. The tick nearest the current scroll
// position lengthens/brightens as you scroll, per the reference
// (section-timeline-preview.framer.website) — a plain progress rail
// rather than that reference's own named-section jump list, since this
// content has no section headings to attach labels to.
const TICK_COUNT = 20

// Tracks `containerId`'s own scroll, not window's — the RP post page
// scrolls internally within one fixed-height pane (rather than the
// whole document growing to the log's full ~90,000px height) so the
// page's shared background grid ((main)/layout.tsx) stays put instead of
// stretching to cover — and scrolling past — that entire height,
// reported directly. Looked up by id rather than passed a ref: the page
// rendering this is a server component, so there's no ref to hand down
// across that boundary without an extra client wrapper just to hold one.
export function ScrollTimeline({ containerId }: { containerId: string }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const el = document.getElementById(containerId)
    if (!el) return

    function onScroll() {
      if (!el) return
      const max = el.scrollHeight - el.clientHeight
      const progress = max > 0 ? el.scrollTop / max : 0
      setActiveIndex(Math.round(progress * (TICK_COUNT - 1)))
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [containerId])

  function jumpTo(i: number) {
    const el = document.getElementById(containerId)
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    el.scrollTo({ top: (i / (TICK_COUNT - 1)) * max, behavior: 'smooth' })
  }

  return (
    <div className="hidden min-[1020px]:flex fixed left-[2.6%] top-1/2 -translate-y-1/2 z-[60] flex-col items-start gap-2.5">
      {Array.from({ length: TICK_COUNT }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => jumpTo(i)}
          aria-label={`Jump to ${Math.round((i / (TICK_COUNT - 1)) * 100)}% of the log`}
          className="py-0.5 -my-0.5"
        >
          <span
            className={`block h-px rounded-full transition-all duration-200 ${i === activeIndex ? 'w-6' : 'w-3 opacity-40'}`}
            style={{ backgroundColor: 'var(--theme-accent)' }}
          />
        </button>
      ))}
    </div>
  )
}
