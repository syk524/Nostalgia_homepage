'use client'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { rememberListView } from '@/lib/list-view-tracker'

// Mounted on the gallery grid page (@children) — records the current list
// URL (including any category filter) so the post modal's close button can
// jump straight back to it after a create/edit round trip.
//
// Because the intercepted post route renders in a parallel @modal slot,
// this component's own page never unmounts when a post opens on top of
// it — but usePathname() is global, so its effect still re-fires with the
// post's URL. Without the guard below, that overwrites the correctly
// recorded list URL with the post URL itself, making the modal's close
// button push to the page it's already on (a no-op that looks broken).
export function TrackListView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname !== '/gallery') return
    const qs = searchParams.toString()
    rememberListView(qs ? `${pathname}?${qs}` : pathname)
  }, [pathname, searchParams])

  return null
}
