'use client'
import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Adapted from beui.dev's Loader component's "dot-matrix" variant
// (beui.dev/components/motion/loader) — reimplemented as its own small
// component rather than pulling in the full 17-variant library and its
// `motion` package dependency, since this is the only variant the app
// actually uses and framer-motion (already installed) has the same API.
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

export function DotMatrixLoader({ size = 32, speed = 1, color = '#5C574D' }: {
  size?: number
  speed?: number
  color?: string
}) {
  const reduce = useReducedMotion() ?? false

  // Every call site in this app (loading.tsx's route boundary, and each
  // form's own closing/loading state) is a full-page replacement — there
  // is no smaller inline use of this component anywhere — so mounting it
  // really does mean "the whole page is busy" for as long as it's on
  // screen. custom-cursor.tsx reads this flag to override whatever's
  // under the pointer with its own "busy" state, matching the Windows
  // "Busy" cursor's own page-wide (not per-element) semantics.
  useEffect(() => {
    document.body.dataset.cursorBusy = 'true'
    return () => { delete document.body.dataset.cursorBusy }
  }, [])

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
