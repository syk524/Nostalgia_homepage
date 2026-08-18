'use client'
import { useEffect } from 'react'

// Renders nothing — disables the macOS trackpad scroll "bounce" for as
// long as this page stays mounted, restoring the default on unmount. Same
// pattern as nav-icon-color-setter.tsx (a direct DOM mutation, since
// html/body are owned by the root layout, not this page) — scoped to just
// this page rather than a global rule in globals.css, since the bounce is
// a normal, wanted feel everywhere else in the app; it's specifically
// this page's full-bleed gradient that has nothing real to show past the
// true end of the page, so overscrolling past it reveals a flash of
// body's own plain background — tried color-matching that flash to the
// gradient first, but a flat stand-in still read as an obvious seam
// against an actual gradient. Removing the bounce here sidesteps that
// entirely. Set on both html AND body — body's overscroll-behavior
// is supposed to propagate to the viewport when html doesn't set its own,
// but that propagation proved unreliable in practice, so it's set
// explicitly on the actual root scrolling element too rather than relying
// on it.
export function ScrollBounceLock() {
  useEffect(() => {
    const previousHtml = document.documentElement.style.overscrollBehaviorY
    const previousBody = document.body.style.overscrollBehaviorY
    document.documentElement.style.overscrollBehaviorY = 'none'
    document.body.style.overscrollBehaviorY = 'none'
    return () => {
      document.documentElement.style.overscrollBehaviorY = previousHtml
      document.body.style.overscrollBehaviorY = previousBody
    }
  }, [])
  return null
}
