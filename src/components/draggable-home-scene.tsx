'use client'
import { useCallback, useRef, useState } from 'react'
import { useDraggable } from '@/lib/use-draggable'
import { Stickers } from '@/components/stickers'
import { StickerGalleryModal } from '@/components/sticker-gallery-modal'
import { PlacedSticker } from '@/components/placed-sticker'
import { DeskAppIcon } from '@/components/desk-app-icon'
import { DockAppWindow } from '@/components/dock-app-window'
import { CalendarDeskWidget } from '@/components/calendar-desk-widget'
import { DOCK_APPS } from '@/lib/dock-apps'
import { savePlacement, removePlacement } from '@/lib/actions/stickers'
import type { StickerGalleryImage, UserBackgroundSticker, CalendarEvent } from '@/types/database'

// Default scattered positions for the desk app icons — spread across
// the lower half so they don't stack on top of each other or the
// sticker (right-[8%]) before a visitor drags them anywhere else.
// Calendar isn't here — it's rendered separately (calendar-desk-widget.tsx)
// with its own persisted position, defaulted below.
const APP_ICON_POSITION: Record<string, string> = {
  settings: 'left-[46%] bottom-[9%]',
  daycounter: 'left-[58%] bottom-[15%]',
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
// gallery are the one thing that IS persisted (per account, editor/admin
// only — see page.tsx, which only passes canEdit/userId through for
// those roles). Nav stays genuinely position:fixed throughout, since
// none of this pan/drag machinery lives on an ancestor of Nav.
export function DraggableHomeScene({ canEdit, userId, initialGalleryImages, initialPlacements, initialEvents }: {
  canEdit: boolean
  userId: string | null
  initialGalleryImages: StickerGalleryImage[]
  initialPlacements: UserBackgroundSticker[]
  initialEvents: CalendarEvent[]
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
    if (!canEdit) return
    if (e.dataTransfer.types.includes('text/sticker-gallery-id')) e.preventDefault()
  }

  async function handleDrop(e: React.DragEvent) {
    if (!canEdit || !userId) return
    const galleryId = e.dataTransfer.getData('text/sticker-gallery-id')
    if (!galleryId) return
    e.preventDefault()

    const rect = sceneRef.current?.getBoundingClientRect()
    const x = (rect ? e.clientX - rect.left : e.clientX) - canvas.offset.x
    const y = (rect ? e.clientY - rect.top : e.clientY) - canvas.offset.y
    const gallery = galleryImages.find(g => g.id === galleryId)
    if (!gallery) return

    const { placement, error } = await savePlacement({ galleryId, x, y, scale: 1, rotation: 0, z: placements.length })
    if (!placement || error) return
    setPlacements(prev => [...prev, { ...placement, gallery }])
  }

  async function handleRemoveSticker(id: string) {
    setPlacements(prev => prev.filter(p => p.id !== id))
    setSelectedId(null)
    await removePlacement(id)
  }

  function handleCommitSticker(id: string, patch: { x: number; y: number; scale: number; rotation: number }) {
    setPlacements(prev => prev.map(p => p.id === id ? { ...p, pos_x: patch.x, pos_y: patch.y, scale: patch.scale, rotation: patch.rotation } : p))
    savePlacement({ id, galleryId: placements.find(p => p.id === id)!.gallery_id, ...patch, z: placements.find(p => p.id === id)!.z })
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
          <img src="/images/nostalgio-wordmark.png" alt="Nostalgia" className="w-full select-none" draggable={false} />
        </div>

        <Stickers panX={canvas.offset.x} panY={canvas.offset.y} onOpenGallery={canEdit ? () => setGalleryOpen(true) : undefined} />

        {placements.map(p => (
          <PlacedSticker
            key={p.id}
            sticker={p}
            panX={canvas.offset.x}
            panY={canvas.offset.y}
            selected={selectedId === p.id}
            onSelect={() => setSelectedId(p.id)}
            onRemove={() => handleRemoveSticker(p.id)}
            onCommit={patch => handleCommitSticker(p.id, patch)}
          />
        ))}

        {DOCK_APPS.map(app => (
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
      </div>

      {/* Rendered as siblings of the pan-handled canvas above, not
          descendants of it — same reasoning as the sticker gallery
          modal: nested inside that div, every click here would also
          bubble into the canvas's own onPointerDown and get captured as
          the start of a pan gesture. */}
      {galleryOpen && canEdit && (
        <StickerGalleryModal
          images={galleryImages}
          ownerId={userId!}
          onClose={() => setGalleryOpen(false)}
          onImagesChange={setGalleryImages}
        />
      )}

      {openApps.map((id, i) => {
        const app = DOCK_APPS.find(a => a.id === id)
        if (!app) return null
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
