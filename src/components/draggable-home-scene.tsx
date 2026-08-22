'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDraggable } from '@/lib/use-draggable'
import { Stickers } from '@/components/stickers'
import { StickerGalleryModal } from '@/components/sticker-gallery-modal'
import { PlacedSticker } from '@/components/placed-sticker'
import { DeskAppIcon } from '@/components/desk-app-icon'
import { DockAppWindow } from '@/components/dock-app-window'
import { CalendarDeskWidget } from '@/components/calendar-desk-widget'
import { DayCounterDeskWidget } from '@/components/day-counter-desk-widget'
import { DOCK_APPS } from '@/lib/dock-apps'
import { savePlacement, removePlacement } from '@/lib/actions/stickers'
import type { StickerGalleryImage, UserBackgroundSticker, CalendarEvent, DayCounter } from '@/types/database'

// A guest (or a logged-in non-editor) still gets a sticker board — they
// just can't write to Supabase (savePlacement/removePlacement both
// require an editor session). Their arrangement lives in this browser's
// localStorage instead: only the fields needed to reconstruct a
// UserBackgroundSticker are stored, and `gallery` is re-joined from the
// already-fetched galleryImages on load rather than snapshotted, so it
// never goes stale if a gallery image is later edited/removed.
const GUEST_PLACEMENTS_KEY = 'guest-sticker-placements'
type StoredGuestPlacement = { id: string; gallery_id: string; pos_x: number; pos_y: number; scale: number; rotation: number; z: number }

function readGuestPlacements(): StoredGuestPlacement[] {
  try {
    const raw = localStorage.getItem(GUEST_PLACEMENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeGuestPlacements(list: UserBackgroundSticker[]) {
  try {
    const stored: StoredGuestPlacement[] = list.map(p => ({
      id: p.id, gallery_id: p.gallery_id, pos_x: p.pos_x, pos_y: p.pos_y, scale: p.scale, rotation: p.rotation, z: p.z,
    }))
    localStorage.setItem(GUEST_PLACEMENTS_KEY, JSON.stringify(stored))
  } catch {
    // Storage unavailable (private mode, quota) — the board still works
    // for this page view, it just won't persist across reloads.
  }
}

// Default scattered positions for the desk app icons — spread across
// the lower half so they don't stack on top of each other or the
// sticker (right-[8%]) before a visitor drags them anywhere else.
// Calendar and Day Counter aren't here — they're rendered separately
// (calendar-desk-widget.tsx, day-counter-desk-widget.tsx) with their own
// persisted positions, defaulted in those components.
const APP_ICON_POSITION: Record<string, string> = {
  settings: 'left-[46%] bottom-[9%]',
}

// The home page's decorative grid + wordmark + sticker + app icons all
// live on one draggable "desk": dragging empty background pans the
// whole scene (the grid's background-position shifts to match, reading
// as an infinite dotted plane); dragging the sticker or an app icon
// directly moves just that element instead (each stops the pan gesture
// from also firing — see useDraggable). The wordmark has no drag of its
// own — it's fixed to the canvas, so it only ever moves by panning
// along with everything else. The pan/sticker/icon arrangement itself
// is never persisted — every reload resets to the default layout, that
// part stays a playful in-session interaction. Placed stickers from the
// gallery are the one thing that IS persisted — for an editor/admin, to
// Supabase (per-account, see page.tsx); for anyone else (a guest, or a
// logged-in viewer), to this browser's own localStorage instead, since
// writing to Supabase needs an owning editor account (see
// GUEST_PLACEMENTS_KEY above). Either way the arrangement survives a
// reload, just not synced anywhere for a guest. Nav stays genuinely
// position:fixed throughout, since none of this pan/drag machinery
// lives on an ancestor of Nav.
export function DraggableHomeScene({ canEdit, isAdmin, userId, initialGalleryImages, initialPlacements, initialEvents, initialDayCounter }: {
  canEdit: boolean
  isAdmin: boolean
  userId: string | null
  initialGalleryImages: StickerGalleryImage[]
  initialPlacements: UserBackgroundSticker[]
  initialEvents: CalendarEvent[]
  initialDayCounter: DayCounter | null
}) {
  const canvas = useDraggable()
  const sceneRef = useRef<HTMLDivElement>(null)

  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryImages, setGalleryImages] = useState(initialGalleryImages)
  const [placements, setPlacements] = useState(initialPlacements)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [openApps, setOpenApps] = useState<string[]>([])
  const [zOrder, setZOrder] = useState<string[]>([])
  const [events, setEvents] = useState(initialEvents)
  const [dayCounter, setDayCounter] = useState(initialDayCounter)
  // Ids that were placed THIS session, so PlacedSticker knows to play
  // its drop-in bounce (.animate-sticker-drop) — everything already in
  // initialPlacements loaded from the DB shouldn't replay that on
  // every page load, only a genuinely new drop should. Cleared per-id
  // ~500ms after placement (comfortably past the 450ms animation) so
  // this doesn't grow for the lifetime of the page.
  const [justPlacedIds, setJustPlacedIds] = useState<Set<string>>(new Set())

  // initialPlacements is always [] for a non-editor (page.tsx never
  // fetches Supabase placements for them) — load whatever they'd
  // previously arranged from localStorage instead, once, after mount.
  // Reconstructs full UserBackgroundSticker objects by re-joining each
  // stored gallery_id against the just-fetched galleryImages, dropping
  // any that no longer resolve (e.g. an image an editor since removed).
  useEffect(() => {
    if (canEdit) return
    const stored = readGuestPlacements()
    if (!stored.length) return
    const restored = stored
      .map((p): UserBackgroundSticker | null => {
        const gallery = galleryImages.find(g => g.id === p.gallery_id)
        return gallery ? { ...p, user_id: 'guest', created_at: '', updated_at: '', gallery } : null
      })
      .filter((p): p is UserBackgroundSticker => p !== null)
    setPlacements(restored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openApp = useCallback((id: string) => {
    setOpenApps(prev => (prev.includes(id) ? prev : [...prev, id]))
    setZOrder(prev => [...prev.filter(x => x !== id), id])
  }, [])

  const closeApp = useCallback((id: string) => {
    setOpenApps(prev => prev.filter(x => x !== id))
    setZOrder(prev => prev.filter(x => x !== id))
  }, [])

  const focusApp = useCallback((id: string) => {
    setZOrder(prev => (prev[prev.length - 1] === id ? prev : [...prev.filter(x => x !== id), id]))
  }, [])

  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('text/sticker-gallery-id')) e.preventDefault()
  }

  async function handleDrop(e: React.DragEvent) {
    const galleryId = e.dataTransfer.getData('text/sticker-gallery-id')
    if (!galleryId) return
    e.preventDefault()

    const rect = sceneRef.current?.getBoundingClientRect()
    const x = (rect ? e.clientX - rect.left : e.clientX) - canvas.offset.x
    const y = (rect ? e.clientY - rect.top : e.clientY) - canvas.offset.y
    const gallery = galleryImages.find(g => g.id === galleryId)
    if (!gallery) return

    const topZ = placements.reduce((max, p) => Math.max(max, p.z), -1) + 1

    let placed: UserBackgroundSticker
    if (canEdit && userId) {
      const { placement, error } = await savePlacement({ galleryId, x, y, scale: 1, rotation: 0, z: topZ })
      if (!placement || error) return
      placed = { ...placement, gallery }
      setPlacements(prev => [...prev, placed])
    } else {
      // Guest (or a logged-in non-editor): same shape, kept local —
      // never sent to Supabase, see GUEST_PLACEMENTS_KEY above.
      placed = {
        id: crypto.randomUUID(), user_id: 'guest', gallery_id: galleryId,
        pos_x: x, pos_y: y, scale: 1, rotation: 0, z: topZ,
        created_at: '', updated_at: '', gallery,
      }
      setPlacements(prev => {
        const next = [...prev, placed]
        writeGuestPlacements(next)
        return next
      })
    }

    setJustPlacedIds(prev => new Set(prev).add(placed.id))
    setTimeout(() => {
      setJustPlacedIds(prev => {
        const next = new Set(prev)
        next.delete(placed.id)
        return next
      })
    }, 500)
  }

  async function handleRemoveSticker(id: string) {
    setPlacements(prev => {
      const next = prev.filter(p => p.id !== id)
      if (!canEdit) writeGuestPlacements(next)
      return next
    })
    setSelectedId(null)
    if (canEdit) await removePlacement(id)
  }

  // Editing (move/resize/rotate) always brings the sticker to the top
  // of the stack, not just placement — z is recomputed as one past the
  // current highest z every time a gesture commits, same "one past the
  // end" rule handleDrop uses for a brand-new sticker.
  function handleCommitSticker(id: string, patch: { x: number; y: number; scale: number; rotation: number }) {
    const topZ = placements.reduce((max, p) => Math.max(max, p.z), -1) + 1
    setPlacements(prev => {
      const next = prev.map(p => p.id === id ? { ...p, pos_x: patch.x, pos_y: patch.y, scale: patch.scale, rotation: patch.rotation, z: topZ } : p)
      if (!canEdit) writeGuestPlacements(next)
      return next
    })
    if (canEdit) {
      savePlacement({ id, galleryId: placements.find(p => p.id === id)!.gallery_id, ...patch, z: topZ })
    }
  }

  return (
    <>
      <div
        ref={sceneRef}
        {...canvas.handlers}
        onPointerDown={e => { setSelectedId(null); canvas.handlers.onPointerDown(e) }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`absolute inset-0 touch-none ${canvas.dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[length:28px_28px] bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)]"
          style={{ backgroundPosition: `${canvas.offset.x}px ${canvas.offset.y}px` }}
        />

        <div
          className="absolute left-1/2 top-1/2 w-[42%] max-w-[640px] pointer-events-none"
          style={{ transform: `translate(${canvas.offset.x}px, ${canvas.offset.y}px) translate(-50%, -50%)` }}
        >
          <img src="/images/nostalgio-wordmark.webp" alt="Nustalgio" className="w-full select-none" draggable={false} />
        </div>

        <Stickers panX={canvas.offset.x} panY={canvas.offset.y} onOpenGallery={() => setGalleryOpen(true)} />

        {placements.map(p => (
          <PlacedSticker
            key={p.id}
            sticker={p}
            panX={canvas.offset.x}
            panY={canvas.offset.y}
            selected={selectedId === p.id}
            justPlaced={justPlacedIds.has(p.id)}
            onSelect={() => setSelectedId(p.id)}
            onRemove={() => handleRemoveSticker(p.id)}
            onCommit={patch => handleCommitSticker(p.id, patch)}
          />
        ))}

        {DOCK_APPS.filter(app => !app.adminOnly || isAdmin).map(app => (
          <DeskAppIcon
            key={app.id}
            app={app}
            panX={canvas.offset.x}
            panY={canvas.offset.y}
            className={APP_ICON_POSITION[app.id] ?? 'left-1/2 bottom-[10%]'}
            onOpen={() => openApp(app.id)}
          />
        ))}

        <CalendarDeskWidget
          panX={canvas.offset.x}
          panY={canvas.offset.y}
          events={events}
          canEdit={canEdit}
          onEventsChange={setEvents}
        />

        {dayCounter && (
          <DayCounterDeskWidget
            panX={canvas.offset.x}
            panY={canvas.offset.y}
            dayCounter={dayCounter}
            canEdit={canEdit}
            onDayCounterChange={setDayCounter}
          />
        )}
      </div>

      {/* Rendered as siblings of the pan-handled canvas above, not
          descendants of it — same reasoning as the sticker gallery
          modal: nested inside that div, every click here would also
          bubble into the canvas's own onPointerDown and get captured as
          the start of a pan gesture. */}
      {galleryOpen && (
        <StickerGalleryModal
          images={galleryImages}
          ownerId={userId}
          canManage={canEdit}
          onClose={() => setGalleryOpen(false)}
          onImagesChange={setGalleryImages}
        />
      )}

      {openApps.map((id, i) => {
        const app = DOCK_APPS.find(a => a.id === id)
        if (!app || (app.adminOnly && !isAdmin)) return null
        return (
          <DockAppWindow
            key={id}
            app={app}
            cascade={i}
            zIndex={50 + zOrder.indexOf(id)}
            onFocus={() => focusApp(id)}
            onClose={() => closeApp(id)}
          />
        )
      })}
    </>
  )
}
