'use client'
import { usePathname } from 'next/navigation'
import { IllustPageBg } from '@/components/illust-page-bg'

// app/loading.tsx's own backdrop — pathname-aware (needs a client
// component for that) rather than the plain IllustPageBg (main)/
// layout.tsx uses. Next's router updates the pathname the moment a
// navigation starts, well before the target route's own async work
// resolves, so this reliably knows where the pending navigation is
// headed even while still rendering as a fallback.
//
// Navigating to the home scene shows nothing here at all, per direct
// request ("do not blur even on the loading status" for the landing
// page) — home's own background is body's plain, unblurred illustration
// (globals.css), already sitting there under every page regardless of
// route, so simply rendering nothing lets it show through exactly as
// crisp as the home page itself will. Any other destination gets the
// usual blurred/dimmed backdrop, animated in (see IllustPageBg's own
// animate prop) since this is the one place that fade should ever play.
export function IllustLoadingBg() {
  const pathname = usePathname()
  if (pathname === '/') return null
  return <IllustPageBg animate />
}
