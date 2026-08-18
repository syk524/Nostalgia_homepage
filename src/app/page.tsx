import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DraggableHomeScene } from '@/components/draggable-home-scene'
import { Nav } from '@/components/nav'
import { fetchStickerGallery, fetchUserPlacements } from '@/lib/sticker-queries'
import { fetchCalendarEvents } from '@/lib/calendar-queries'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data
    : null

  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'
  const [galleryImages, placements] = canEdit && user
    ? await Promise.all([fetchStickerGallery(supabase), fetchUserPlacements(supabase, user.id)])
    : [[], []]

  // Unlike the sticker gallery, the calendar is open to every visitor —
  // RLS on calendar_events already filters rows down to what this
  // session (including a signed-out one) is allowed to see, so this
  // fetch runs unconditionally rather than being gated by canEdit.
  const calendarEvents = await fetchCalendarEvents(supabase)

  return (
    <div className="relative min-h-screen overflow-hidden bg-scroll-100">
      <DraggableHomeScene
        canEdit={canEdit}
        userId={user?.id ?? null}
        initialGalleryImages={galleryImages}
        initialPlacements={placements}
        initialEvents={calendarEvents}
      />

      <Suspense fallback={null}>
        <Nav profile={profile} categories={[]} />
      </Suspense>
    </div>
  )
}
