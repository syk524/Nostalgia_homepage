'use client'
import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Adapted from beui.dev's Loader component's "dot-matrix" variant
// (beui.dev/components/motion/loader) — reimplemented as its own small
// component rather than pulling in the full 17-variant library and its
// `motion` package dependency, since this is the only variant the app
// actually uses and framer-motion (already installed) has the same API.
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

export function DotMatrixLoader({ size = 32, speed = 1, color = '#2F2F2E', busyCursor = true }: {
  size?: number
  speed?: number
  color?: string
  // Every other call site in this app (loading.tsx's route boundary, and
  // each form's own closing/loading state) is a full-page replacement,
  // where mounting this really does mean "the whole page is busy" — see
  // custom-cursor.tsx, which reads this flag to override whatever's under
  // the pointer with its own page-wide "Busy" cursor. An inline use next
  // to still-interactive UI (e.g. an iframe preview loading while the
  // rest of the page stays clickable) isn't that, so it opts out.
  busyCursor?: boolean
}) {
  const reduce = useReducedMotion() ?? false

  useEffect(() => {
    if (!busyCursor) return
    document.body.dataset.cursorBusy = 'true'
    return () => { delete document.body.dataset.cursorBusy }
  }, [busyCursor])

  const n = 3
  const gap = size * 0.14
  const dot = (size - gap * (n - 1)) / n
  const cells = Array.from({ length: n * n }, (_, idx) => idx)

  return (
    <span
      role="status"
      aria-label="Loading"
      className="inline-grid"
      style={{ gap, gridTemplateColumns: `repeat(${n}, ${dot}px)`, color }}
    >
      {cells.map(idx => {
        const x = idx % n
        const y = Math.floor(idx / n)
        // Diagonal wave: cells light in order of their distance from the corner.
        const delay = ((x + y) / (2 * (n - 1))) * speed
        return (
          <motion.span
            key={idx}
            className="rounded-full bg-current"
            style={{ width: dot, height: dot }}
            animate={reduce ? { opacity: [0.3, 1, 0.3] } : { opacity: [0.2, 1, 0.2], scale: [0.7, 1, 0.7] }}
            transition={{ duration: speed, ease: EASE_IN_OUT, repeat: Infinity, delay }}
          />
        )
      })}
      <span className="sr-only">Loading</span>
    </span>
  )
}
