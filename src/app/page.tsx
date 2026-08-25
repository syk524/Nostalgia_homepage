import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DraggableHomeScene } from '@/components/draggable-home-scene'
import { Nav } from '@/components/nav'
import { fetchStickerGallery, fetchUserPlacements } from '@/lib/sticker-queries'
import { fetchCalendarEvents } from '@/lib/calendar-queries'
import { fetchDayCounter } from '@/lib/day-counter-queries'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data
    : null

  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'
  const isAdmin = profile?.role === 'admin'

  // The gallery itself (which stickers exist to place) is shared/global,
  // not per-owner — RLS allows anonymous SELECT, so every visitor sees
  // the same picker. Placements are the opposite: per-account, editor/
  // admin only. A guest (or a logged-in viewer) still gets a sticker
  // board, just not this Supabase-backed one — draggable-home-scene.tsx
  // seeds their placements from localStorage client-side instead.
  const galleryImages = await fetchStickerGallery(supabase)
  const placements = canEdit && user ? await fetchUserPlacements(supabase, user.id) : []

  // Unlike the sticker gallery, the calendar is open to every visitor —
  // RLS on calendar_events already filters rows down to what this
  // session (including a signed-out one) is allowed to see, so this
  // fetch runs unconditionally rather than being gated by canEdit.
  const calendarEvents = await fetchCalendarEvents(supabase)

  // Same reasoning as the calendar — a single global row, public to
  // every visitor, RLS-gated on write rather than read.
  const dayCounter = await fetchDayCounter(supabase)

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: 'var(--theme-bg)' }}>
      <DraggableHomeScene
        canEdit={canEdit}
        isAdmin={isAdmin}
        userId={user?.id ?? null}
        initialGalleryImages={galleryImages}
        initialPlacements={placements}
        initialEvents={calendarEvents}
        initialDayCounter={dayCounter}
      />

      <Suspense fallback={null}>
        {/* categoryPostCounts/totalPostCount only matter for the gallery
            category rail, which never renders here (onGallery is false
            on the homepage) — empty/0 placeholders, same as the already-
            empty categories array above. */}
        <Nav profile={profile} categories={[]} categoryPostCounts={{}} totalPostCount={0} />
      </Suspense>
    </div>
  )
}
