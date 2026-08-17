'use client'
import { useEffect } from 'react'

// Renders nothing — overrides the --nav-icon-color CSS variable (see
// globals.css) on document.documentElement for as long as this page stays
// mounted, restoring the default on unmount. A direct DOM mutation, not
// React state passed down to Nav: Nav is mounted once at the layout level
// and never remounts between pages, so a page can't reach it via props —
// and routing this through React state/context instead produced a
// hydration-mismatch edge case (suppressHydrationWarning doesn't reliably
// self-heal for a value that keeps changing after the initial mismatch,
// intermittently leaving Nav stuck on the default color). A CSS variable
// the browser resolves at paint time sidesteps that entirely.
export function NavIconColorSetter({ color }: { color: string }) {
  useEffect(() => {
    document.documentElement.style.setProperty('--nav-icon-color', color)
    return () => { document.documentElement.style.removeProperty('--nav-icon-color') }
  }, [color])
  return null
}
