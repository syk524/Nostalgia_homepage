import { createClient } from '@/lib/supabase/server'
import { DraggableHomeScene } from '@/components/draggable-home-scene'
import { fetchStickerGallery, fetchUserPlacements } from '@/lib/sticker-queries'
import { fetchCalendarEvents } from '@/lib/calendar-queries'
import { fetchDayCounter } from '@/lib/day-counter-queries'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Still needed here for canEdit/isAdmin below even though Nav itself
  // no longer renders from this page — Nav (and its own separate
  // profile/categories fetch) moved to the root layout's NavWithData, so
  // it's a single instance shared with every other page instead of a
  // second copy that unmounted/remounted the shared one on the way in or
  // out of this route, reported directly.
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

  // No inline backgroundColor on the wrapper below (removed) — it
  // duplicated body's own identical `background-color: var(--theme-bg)`
  // (globals.css), painting an opaque flat color over body the instant
  // this div mounted, before DraggableHomeScene's own child Image had
  // necessarily decoded and painted on top of it. For Illust that color
  // is solid black, and body now also carries the theme's own
  // illustration as a background-image (globals.css) specifically so
  // something resembling the final picture is visible underneath any
  // gap — this div being opaque defeated that. Removing it is a no-op
  // for Noir/Sticker, which still see the identical color via body's
  // own rule; for Illust it closes the black-flash gap this was
  // reported for.
  return (
    <div className="home-scene-wrapper relative min-h-screen overflow-hidden">
      <DraggableHomeScene
        canEdit={canEdit}
        isAdmin={isAdmin}
        userId={user?.id ?? null}
        initialGalleryImages={galleryImages}
        initialPlacements={placements}
        initialEvents={calendarEvents}
        initialDayCounter={dayCounter}
      />
    </div>
  )
}
