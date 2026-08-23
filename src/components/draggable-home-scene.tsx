'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { useDraggable } from '@/lib/use-draggable'
import { Stickers } from '@/components/stickers'
import { StickerGalleryModal } from '@/components/sticker-gallery-modal'
import { PlacedSticker } from '@/components/placed-sticker'
import { DeskAppIcon } from '@/components/desk-app-icon'
import { DockAppWindow } from '@/components/dock-app-window'
import { CalendarDeskWidget } from '@/components/calendar-desk-widget'
import { DayCounterDeskWidget } from '@/components/day-counter-desk-widget'
import { SettingsPanel } from '@/components/settings-panel'
import { NoirBackground } from '@/components/noir-background'
import { DOCK_APPS } from '@/lib/dock-apps'
import { THEMES, type ThemeKey } from '@/lib/themes'
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

// No real placement id ever equals this, so passing it as `topId` to
// renormalizePlacements below just sorts everyone into a clean 0..N-1
// range in their existing relative order, with no one singled out for
// the very top — used for a first-load fix-up rather than a specific
// edit.
const NO_TOP_ID = '__none__'

// Placed stickers used to climb z forever (every drag/edit bumped the
// whole set's max by one, with no ceiling) — PlacedSticker turns that
// into a raw zIndex of 10 + z, which after enough interactions in a
// session could climb past fixed chrome sharing the same stacking
// context (Nav, the music player, the Settings icon/window all sit
// around z-[50] to z-[70], see nav.tsx/sound-player/dock-app-window.tsx),
// burying them under a sticker. This renormalizes the WHOLE set back to
// a clean, small 0..N-1 range on every commit — `topId` lands at the
// very top (n-1), everyone else keeps their relative order but shifts
// down to close the gap — so the ceiling stays pinned to how many
// stickers are actually placed instead of how many edits ever happened,
// and self-heals any placement still carrying a stale, oversized z from
// before this existed.
function renormalizePlacements(list: UserBackgroundSticker[], topId: string): UserBackgroundSticker[] {
  const sorted = [...list].sort((a, b) => a.z - b.z)
  const sequenced = [...sorted.filter(p => p.id !== topId), ...sorted.filter(p => p.id === topId)]
  const zById = new Map(sequenced.map((p, i) => [p.id, i]))
  return list.map(p => ({ ...p, z: zById.get(p.id)! }))
}

// Saves just the placements whose z actually changed as a result of
// renormalizing — savePlacement always writes the full row, so this
// resends each one's own (unchanged) position/scale/rotation alongside
// its new z. `skipId` excludes whichever sticker the caller is already
// saving separately with a guaranteed-fresh patch, so it isn't written
// twice. Editor/admin only — guests never call this, see
// writeGuestPlacements, which just re-serializes the whole array.
function persistZChanges(prevList: UserBackgroundSticker[], nextList: UserBackgroundSticker[], skipId: string) {
  const prevZById = new Map(prevList.map(p => [p.id, p.z]))
  for (const p of nextList) {
    if (p.id === skipId || prevZById.get(p.id) === p.z) continue
    savePlacement({ id: p.id, galleryId: p.gallery_id, x: p.pos_x, y: p.pos_y, scale: p.scale, rotation: p.rotation, z: p.z })
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

// On a non-default theme, Settings/Calendar/DayCounter dock as three
// plain, fixed trigger icons at the right edge, vertically centered,
// right-aligned to Settings — they never resize or morph (see the
// `docked` prop on Calendar/DayCounter). Clicking one opens its actual
// panel as a separate element pinned to the top-left of the screen
// instead. There, Calendar/DayCounter still reflow between two slots as
// they open — Calendar always takes the top slot whenever it's open;
// DayCounter takes the top slot only when it's the only one of the two
// open, otherwise the slot right below Calendar — computed live since it
// depends on both widgets' open state at once (see
// calendarPanelTop/dayCounterPanelTop below). The dock icons themselves
// never reflow — their positions are fixed constants.
const DOCK_GAP = 16
const DOCK_ICON_SIZE = 44
const DOCK_CALENDAR_OPEN_HEIGHT = 400
// Settings' own height plus one gap — where the Calendar icon sits.
// (Previously had an extra leading gap baked in, which doubled the
// Settings→Calendar spacing relative to Calendar→DayCounter.)
const DOCK_ITEMS_TOP = DOCK_ICON_SIZE + DOCK_GAP
// Vertically centers the default (3-icon, all-collapsed) dock at rest —
// see the settings/Calendar/DayCounter dock icons below, which never
// move once mounted, so this offset is a plain constant.
const DOCK_ANCHOR_OFFSET = (DOCK_ICON_SIZE * 3 + DOCK_GAP * 2) / 2
const PANEL_MARGIN = 16

// The home page's decorative grid + wordmark + sticker + app icons all
// live on one draggable "desk": dragging empty background pans the
// whole scene (the grid's background-position shifts to match, reading
// as an infinite dotted plane); dragging the sticker or an app icon
// directly moves just that element instead (each stops the pan gesture
// from also firing — see useDraggable). The wordmark has no drag of its
// own — it's fixed to the canvas, so it only ever moves by panning
// along with everything else. All of that (grid, wordmark, pan gesture
// itself) is Default-theme only — a non-default theme (see lib/themes.ts)
// drops them for a calmer, static backdrop; Settings/Calendar/DayCounter
// still render and stay individually draggable regardless of theme. The
// pan/sticker/icon arrangement itself is never persisted — every reload
// resets to the default layout, that part stays a playful in-session
// interaction. Placed stickers from the
// gallery are the one thing that IS persisted — for an editor/admin, to
// Supabase (per-account, see page.tsx); for anyone else (a guest, or a
// logged-in viewer), to this browser's own localStorage instead, since
// writing to Supabase needs an owning editor account (see
// GUEST_PLACEMENTS_KEY above). Either way the arrangement survives a
// reload, just not synced anywhere for a guest. Nav stays genuinely
// position:fixed throughout, since none of this pan/drag machinery
// lives on an ancestor of Nav.
export function DraggableHomeScene({ canEdit, isAdmin, userId, initialGalleryImages, initialPlacements, initialEvents, initialDayCounter, initialTheme }: {
  canEdit: boolean
  isAdmin: boolean
  userId: string | null
  initialGalleryImages: StickerGalleryImage[]
  initialPlacements: UserBackgroundSticker[]
  initialEvents: CalendarEvent[]
  initialDayCounter: DayCounter | null
  initialTheme: ThemeKey
}) {
  const canvas = useDraggable()
  const sceneRef = useRef<HTMLDivElement>(null)

  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryImages, setGalleryImages] = useState(initialGalleryImages)
  // Renormalized up front, not just on the next edit — an editor/admin's
  // initialPlacements can still carry z values from before this bounding
  // existed (some placed long ago, never re-dragged since), and those
  // would otherwise keep covering fixed chrome indefinitely since
  // nothing else would ever touch them. See renormalizePlacements below.
  const [placements, setPlacements] = useState(() => renormalizePlacements(initialPlacements, NO_TOP_ID))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemeKey>(initialTheme)

  // Instant, no-reload recolor when the Settings dropdown changes theme —
  // same imperative-DOM pattern as nav-icon-color-setter.tsx, since these
  // vars are read by CSS across the whole document (nav, this page's own
  // background), not just this component's own React tree.
  function handleThemeChange(next: ThemeKey) {
    setTheme(next)
    const t = THEMES[next]
    document.documentElement.style.setProperty('--theme-accent', t.pointColor)
    document.documentElement.style.setProperty('--theme-bg', t.background)
    // Some overrides (button hovers, panel backgrounds — see globals.css's
    // [data-theme="noir"] rules) can't be expressed as a CSS variable
    // value swap alone; they need a real selector to hook into.
    document.documentElement.setAttribute('data-theme', next)
  }

  // Ephemeral — deliberately not persisted, matching "show collapsed as
  // default" for the dock. Only meaningful on a non-default theme;
  // Calendar/DayCounter keep their own independent, localStorage-backed
  // open state for the default theme's undocked rendering.
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [dayCounterOpen, setDayCounterOpen] = useState(false)

  // The three dock icons never move — Settings sits at the top, Calendar
  // and DayCounter fixed right below it, all right-aligned and centered
  // as one group at rest (see DOCK_ANCHOR_OFFSET above). Positioned from
  // the viewport's own vertical center (not a separate wrapper) since
  // Calendar/DayCounter already render inside the scene div, which is
  // itself full-viewport.
  const dockTop = (offset: number) => `calc(50% - ${DOCK_ANCHOR_OFFSET}px + ${offset}px)`
  const calendarDockTop = dockTop(DOCK_ITEMS_TOP)
  const dayCounterDockTop = dockTop(DOCK_ITEMS_TOP + DOCK_ICON_SIZE + DOCK_GAP)

  // The actual panels, opened separately at the top-left of the screen,
  // still reflow the way the dock icons used to: Calendar's panel is
  // always first (top) whenever it's open; DayCounter's panel takes that
  // same top slot only when Calendar's isn't open, otherwise it sits
  // right below Calendar's.
  const calendarPanelTop = `${PANEL_MARGIN}px`
  const dayCounterPanelTop = calendarOpen ? `${PANEL_MARGIN + DOCK_CALENDAR_OPEN_HEIGHT + DOCK_GAP}px` : `${PANEL_MARGIN}px`

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
    // Same first-load fix-up as the editor path above — localStorage can
    // carry the same kind of stale, oversized z from before this existed.
    const normalized = renormalizePlacements(restored, NO_TOP_ID)
    setPlacements(normalized)
    writeGuestPlacements(normalized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persists the editor-path fix-up from the lazy useState initializer
  // above — placements is already renormalized in the very first render,
  // this just makes sure any values that fix-up actually changed get
  // written back to Supabase once, rather than silently drifting from
  // what's in the DB until the next real edit touches them.
  useEffect(() => {
    if (!canEdit || !userId || !initialPlacements.length) return
    const normalized = renormalizePlacements(initialPlacements, NO_TOP_ID)
    persistZChanges(initialPlacements, normalized, NO_TOP_ID)
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

    // Provisional — renormalizePlacements below immediately rewrites
    // every z (including this one) to a clean 0..N-1 range, so the exact
    // starting value here only matters in that it goes on top for now.
    const provisionalZ = placements.length

    let placed: UserBackgroundSticker
    if (canEdit && userId) {
      const { placement, error } = await savePlacement({ galleryId, x, y, scale: 1, rotation: 0, z: provisionalZ })
      if (!placement || error) return
      placed = { ...placement, gallery }
      const baseList = [...placements, placed]
      const next = renormalizePlacements(baseList, placed.id)
      setPlacements(next)
      persistZChanges(baseList, next, placed.id)
    } else {
      // Guest (or a logged-in non-editor): same shape, kept local —
      // never sent to Supabase, see GUEST_PLACEMENTS_KEY above.
      placed = {
        id: crypto.randomUUID(), user_id: 'guest', gallery_id: galleryId,
        pos_x: x, pos_y: y, scale: 1, rotation: 0, z: provisionalZ,
        created_at: '', updated_at: '', gallery,
      }
      const next = renormalizePlacements([...placements, placed], placed.id)
      setPlacements(next)
      writeGuestPlacements(next)
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
  // of the stack, not just placement — see renormalizePlacements above
  // for why this reassigns everyone's z instead of just growing this
  // one's forever.
  function handleCommitSticker(id: string, patch: { x: number; y: number; scale: number; rotation: number }) {
    const updated = placements.map(p => p.id === id ? { ...p, pos_x: patch.x, pos_y: patch.y, scale: patch.scale, rotation: patch.rotation } : p)
    const next = renormalizePlacements(updated, id)
    setPlacements(next)
    if (canEdit) {
      persistZChanges(updated, next, id)
      const edited = next.find(p => p.id === id)!
      savePlacement({ id, galleryId: edited.gallery_id, x: edited.pos_x, y: edited.pos_y, scale: edited.scale, rotation: edited.rotation, z: edited.z })
    } else {
      writeGuestPlacements(next)
    }
  }

  return (
    <>
      <div
        ref={sceneRef}
        {...(theme === 'default' ? canvas.handlers : {})}
        onPointerDown={theme === 'default' ? e => { setSelectedId(null); canvas.handlers.onPointerDown(e) } : undefined}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`absolute inset-0 touch-none ${theme === 'default' ? (canvas.dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      >
        {theme === 'default' ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[length:28px_28px] bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)]"
            style={{ backgroundPosition: `${canvas.offset.x}px ${canvas.offset.y}px` }}
          />
        ) : (
          <NoirBackground />
        )}

        {theme === 'default' && (
          <div
            className="absolute left-1/2 top-1/2 w-[42%] max-w-[640px] pointer-events-none"
            style={{ transform: `translate(${canvas.offset.x}px, ${canvas.offset.y}px) translate(-50%, -50%)` }}
          >
            <img src="/images/nostalgio-wordmark.webp" alt="Nustalgio" className="w-full select-none" draggable={false} />
          </div>
        )}

        {theme === 'default' && (
          <Stickers panX={canvas.offset.x} panY={canvas.offset.y} onOpenGallery={() => setGalleryOpen(true)} />
        )}

        {theme === 'default' && placements.map(p => (
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

        {theme === 'default' && DOCK_APPS.filter(app => !app.requiresAuth || userId).map(app => (
          <DeskAppIcon
            key={app.id}
            app={app}
            panX={canvas.offset.x}
            panY={canvas.offset.y}
            className={APP_ICON_POSITION[app.id] ?? 'left-1/2 bottom-[10%]'}
            onOpen={() => openApp(app.id)}
          />
        ))}

        {theme !== 'default' && userId && (
          <button
            type="button"
            onClick={() => openApp('settings')}
            aria-label="Open Settings"
            className="fixed flex items-center justify-center rounded-2xl"
            style={{ top: dockTop(0), right: DOCK_GAP, width: DOCK_ICON_SIZE, height: DOCK_ICON_SIZE, background: '#282625' }}
          >
            <SettingsIcon size={18} className="text-scroll-100" />
          </button>
        )}

        <CalendarDeskWidget
          panX={canvas.offset.x}
          panY={canvas.offset.y}
          events={events}
          canEdit={canEdit}
          onEventsChange={setEvents}
          docked={theme === 'default' ? undefined : { open: calendarOpen, dockTop: calendarDockTop, panelTop: calendarPanelTop, onOpenChange: setCalendarOpen }}
        />

        {dayCounter && (
          <DayCounterDeskWidget
            panX={canvas.offset.x}
            panY={canvas.offset.y}
            dayCounter={dayCounter}
            canEdit={canEdit}
            onDayCounterChange={setDayCounter}
            docked={theme === 'default' ? undefined : { open: dayCounterOpen, dockTop: dayCounterDockTop, panelTop: dayCounterPanelTop, onOpenChange: setDayCounterOpen }}
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
        if (!app || (app.requiresAuth && !userId)) return null
        return (
          <DockAppWindow
            key={id}
            app={app}
            cascade={i}
            zIndex={50 + zOrder.indexOf(id)}
            onFocus={() => focusApp(id)}
            onClose={() => closeApp(id)}
          >
            {app.id === 'settings' && <SettingsPanel theme={theme} onThemeChange={handleThemeChange} />}
          </DockAppWindow>
        )
      })}
    </>
  )
}
