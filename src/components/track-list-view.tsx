'use client'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { rememberListView } from '@/lib/list-view-tracker'

// Mounted only on the actual gallery grid page — records the current list
// URL (including any category filter) so the post modal's close button can
// jump straight back to it after a create/edit round trip.
export function TrackListView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const qs = searchParams.toString()
    rememberListView(qs ? `${pathname}?${qs}` : pathname)
  }, [pathname, searchParams])

  return null
}
