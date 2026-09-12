'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import Image from 'next/image'
import { Settings as SettingsIcon, Link as LinkIcon } from 'lucide-react'
import wordmark from '../../public/images/nostalgio-wordmark.webp'
import illustThemeBg from '../../public/images/illust-theme-bg.webp'
import xWidgetBg from '../../public/images/x-widget-bg.png'
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
import { ParticleEffect } from '@/components/particle-effects'
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
// persisted positions, defaulted in those components — but this icon's
// own default still has to steer clear of theirs, since a first-time
// visitor sees both widgets already open (560px and 360px wide) by
// default. The original left-46% put it inside Calendar's open box
// (fixed at x:420-980px) at basically every normal desktop width, since
// 46% of anything from ~950px to ~2100px wide lands in that same range
// — reported directly. left-10% stays clear of that fixed-pixel zone up
// to about a 4200px-wide screen, and (at bottom-9%) clear of the
// nav's own bottom-left login/profile chip (left-2.6%, bottom-3%) too.
const APP_ICON_POSITION: Record<string, string> = {
  settings: 'left-[10%] bottom-[9%]',
  // Directly above Settings — the two read as one small cluster instead
  // of a second icon dropped at an arbitrary, unrelated spot. Like every
  // other desk icon, this is a starting position only, not persisted —
  // dragging it elsewhere doesn't survive a reload (see the big comment
  // below on the desk's own pan/drag machinery).
  'x-handle': 'left-[10%] bottom-[18%]',
}

// The project's X (Twitter) account — the "T" in Noir/Illust's own
// scattered wordmark (noir-background.tsx) already links here too; this
// dock/desk icon is a second, more discoverable entry point to the same
// place, per direct request.
const X_HANDLE_URL = 'https://x.com/Nustalgio'

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
// Vertically centers the default (4-icon, all-collapsed) dock at rest —
// see the Settings/Calendar/DayCounter/X-handle dock icons below, which
// never move once mounted, so this offset is a plain constant. (4, not 3
// — the X-handle icon added below Day Counter per direct request.)
const DOCK_ANCHOR_OFFSET = (DOCK_ICON_SIZE * 4 + DOCK_GAP * 3) / 2
const PANEL_MARGIN = 16
// Matches the 400ms `top` transition both desk widgets' own docked panels
// already use (calendar-desk-widget.tsx/day-counter-desk-widget.tsx) —
// the move-then-fade/fade-then-move orchestration below needs to know
// exactly how long that move takes, so the two never overlap.
const TRANSITION_MS = 400

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
  // Renormalized up front, not just on the next edit — an editor/admin's
  // initialPlacements can still carry z values from before this bounding
  // existed (some placed long ago, never re-dragged since), and those
  // would otherwise keep covering fixed chrome indefinitely since
  // nothing else would ever touch them. See renormalizePlacements below.
  const [placements, setPlacements] = useState(() => renormalizePlacements(initialPlacements, NO_TOP_ID))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Owned by ThemeProvider (theme-provider.tsx), not local state here —
  // this component only exists on the '/' route and is torn down and
  // recreated on every navigation away and back, so local state here
  // couldn't survive that round trip. It used to, seeded fresh from a
  // server-provided initialTheme prop each remount, plus an effect that
  // re-applied it to <html> on every mount to patch a *different* staleness
  // bug (the shared root layout not always re-rendering on navigation) —
  // but that fix broke the opposite way: the prop itself could ALSO be
  // stale (Next's client Router Cache reusing '/'  's pre-switch RSC
  // payload on a quick round trip), so a correct Noir choice got
  // overwritten back to Default instead of preserved, reported directly.
  // ThemeProvider sidesteps both failure modes at once — it lives in the
  // ROOT layout, which survives client-side navigation between routes
  // without unmounting, so its state (and the <html> sync effect that
  // used to live here) never needs to be reconstructed from a
  // navigation-provided prop that might be behind the live client state.
  const { theme, setTheme } = useTheme()

  // Ephemeral — deliberately not persisted, matching "show collapsed as
  // default" for the dock. Only meaningful on a non-default theme;
  // Calendar/DayCounter keep their own independent, localStorage-backed
  // open state for the default theme's undocked rendering.
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [dayCounterOpen, setDayCounterOpen] = useState(false)

  // Orchestrates Calendar's own open/close against DayCounter's move,
  // per direct request — DayCounter always defers to Calendar (see
  // dayCounterPanelTop below, which reads calendarSlotOccupied rather
  // than the raw calendarOpen intent), so only this direction needs
  // sequencing; DayCounter opening/closing never displaces Calendar,
  // whose own panelTop is a fixed PANEL_MARGIN regardless.
  //
  // calendarOpen above stays the raw click intent (what the dock icon's
  // own aria-label/toggle reflects); these three track the actual
  // panel's mount/fade lifecycle, which lags that intent by one
  // TRANSITION_MS step in either direction whenever DayCounter is also
  // open and has to move out of the way first:
  //   opening:  DayCounter starts moving immediately (calendarSlotOccupied
  //             flips right away); Calendar's own fade-in (calendarVisible)
  //             waits until that move has finished.
  //   closing:  Calendar fades out immediately (calendarVisible flips
  //             right away, calendarMounted stays true so the fade can
  //             actually play); only once that fade-out finishes does
  //             DayCounter move back up (calendarSlotOccupied flips) and
  //             the panel actually unmount (calendarMounted flips).
  // With DayCounter closed, none of this delay applies — nothing needs
  // to move, so Calendar just opens/closes immediately, same as before.
  const [calendarMounted, setCalendarMounted] = useState(false)
  const [calendarVisible, setCalendarVisible] = useState(false)
  const [calendarSlotOccupied, setCalendarSlotOccupied] = useState(false)

  useEffect(() => {
    if (calendarOpen) {
      setCalendarMounted(true)
      if (dayCounterOpen) {
        setCalendarSlotOccupied(true)
        setCalendarVisible(false)
        const t = setTimeout(() => setCalendarVisible(true), TRANSITION_MS)
        return () => clearTimeout(t)
      }
      setCalendarSlotOccupied(true)
      setCalendarVisible(true)
    } else {
      setCalendarVisible(false)
      if (dayCounterOpen) {
        const t = setTimeout(() => {
          setCalendarSlotOccupied(false)
          setCalendarMounted(false)
        }, TRANSITION_MS)
        return () => clearTimeout(t)
      }
      setCalendarSlotOccupied(false)
      setCalendarMounted(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarOpen])

  // The four dock icons never move — Settings sits at the top, Calendar,
  // DayCounter, and the X-handle link fixed right below it in that order,
  // all right-aligned and centered as one group at rest (see
  // DOCK_ANCHOR_OFFSET above). Positioned from the viewport's own
  // vertical center (not a separate wrapper) since Calendar/DayCounter
  // already render inside the scene div, which is itself full-viewport.
  const dockTop = (offset: number) => `calc(50% - ${DOCK_ANCHOR_OFFSET}px + ${offset}px)`
  const calendarDockTop = dockTop(DOCK_ITEMS_TOP)
  const dayCounterDockTop = dockTop(DOCK_ITEMS_TOP + DOCK_ICON_SIZE + DOCK_GAP)
  const xHandleDockTop = dockTop(DOCK_ITEMS_TOP + 2 * (DOCK_ICON_SIZE + DOCK_GAP))

  // The actual panels, opened separately at the top-left of the screen,
  // still reflow the way the dock icons used to: Calendar's panel is
  // always first (top) whenever it's open; DayCounter's panel takes that
  // same top slot only when Calendar's isn't open, otherwise it sits
  // right below Calendar's.
  const calendarPanelTop = `${PANEL_MARGIN}px`
  // calendarSlotOccupied, not the raw calendarOpen — on close, this stays
  // true (keeping DayCounter shifted down) until Calendar's own fade-out
  // has actually finished, per the orchestration above; using the raw
  // intent here would move DayCounter back up the instant the icon is
  // clicked, well before Calendar visually vacates the slot.
  const dayCounterPanelTop = calendarSlotOccupied ? `${PANEL_MARGIN + DOCK_CALENDAR_OPEN_HEIGHT + DOCK_GAP}px` : `${PANEL_MARGIN}px`

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
        // touch-none only for Default's own drag-to-pan canvas — it
        // disables the browser's native touch scroll/gesture handling so
        // canvas.handlers can drive panning itself instead, but Noir and
        // Illust have no drag gesture of their own (canvas.handlers isn't
        // even wired up for them, just above) and blanket-disabling touch
        // scrolling for every theme left their landing page unscrollable
        // on touch devices too, reported directly alongside the same bug
        // for mouse/wheel scrolling (globals.css's .home-scene-wrapper).
        className={`absolute inset-0 ${theme === 'default' ? `touch-none ${canvas.dragging ? 'cursor-grabbing' : 'cursor-grab'}` : ''}`}
      >
        {theme === 'default' ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[length:28px_28px] bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)]"
            style={{ backgroundPosition: `${canvas.offset.x}px ${canvas.offset.y}px` }}
          />
        ) : (
          <>
            {/* Illust's own landing-page backdrop, per direct request —
                the one deliberate visual difference from Noir (both
                otherwise share every noir-* CSS rule and component
                branch, see lib/themes.ts's own NOIR_LIKE comment).
                Sits behind NoirBackground's particle field/wordmark
                rather than replacing it, since "add this picture to the
                background" was additive, not a request to redesign
                Illust's decoration from scratch. */}
            {theme === 'illust' && (
              // illust-home-fade-in (its own dedicated animation, not
              // the shared 0.3s animate-fade-in utility used elsewhere —
              // tuned independently rather than risking every other
              // caller of that class) — softens the swap from the root
              // loading.tsx's own blurred/dimmed illustration
              // (globals.css's .illust-page-bg) into this crisp,
              // undimmed one, reported directly as a harsh flash
              // otherwise: Suspense hard-swaps a fallback for real
              // content with no crossfade of its own, so the moment
              // this mounts, going from dark+soft to bright+sharp in a
              // single frame read as a flash regardless of how briefly
              // the fallback showed. A plain opacity fade-in doesn't
              // truly crossfade between the two different treatments,
              // but it turns the pop-in into a smooth reveal instead.
              // Slower/gentler than the loading backdrop's own 0.2s fade
              // (globals.css's .illust-page-bg-enter) per direct request
              // for a smoother reveal specifically on this leg (another
              // page back to the landing page) — that one only has to
              // bridge a much smaller visual gap (nothing to blurred),
              // while this one bridges the loading screen all the way to
              // the final, fully-detailed scene.
              <div className="absolute inset-0 illust-home-fade-in">
                <Image
                  src={illustThemeBg}
                  alt=""
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover"
                />
                {/* Top-down darkening so the nav (fixed, top-[3%], z-[60]
                    — nav.tsx) stays readable over a busy illustration
                    instead of competing with whatever's directly behind
                    it — per direct request, same size/placement as a
                    reference image's own top gradient, black instead of
                    that reference's red. Sits above the illustration but
                    (no z-index of its own, just later in DOM order) still
                    well under nav's z-[60], which lives outside this
                    component entirely. */}
                <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/60 to-transparent" />
                {/* Twinkling stars + occasional shooting-star streaks, per
                    direct request (reference: innocent-aim-546625.framer.app)
                    — the same shared particle-effects.tsx system TRPG
                    sessions pick from (see PARTICLE_EFFECTS), reused here
                    rather than a one-off implementation. z-[1] (baked into
                    ParticleEffect's own className) sits above the
                    illustration/gradient here but still well under nav's
                    z-[60]. */}
                <ParticleEffect effect="shooting-stars" />
              </div>
            )}
            {/* No ripple, and no particle field at all (grid twinkle +
                cursor-repulsion hover), over Illust's own illustration —
                per direct request, both read as too busy layered on top
                of a full background image, unlike Noir's plain backdrop. */}
            <NoirBackground ripple={theme !== 'illust'} particles={theme !== 'illust'} />
          </>
        )}

        {theme === 'default' && (
          <div
            className="absolute left-1/2 top-1/2 w-[42%] max-w-[640px] pointer-events-none"
            style={{ transform: `translate(${canvas.offset.x}px, ${canvas.offset.y}px) translate(-50%, -50%)` }}
          >
            <Image src={wordmark} alt="Nustalgio" priority className="w-full h-auto select-none" draggable={false} />
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

        {/* X-handle link — not one of DOCK_APPS/openApp's real "apps"
            (there's no panel to open, DockAppWindow is never involved),
            so it's a standalone DeskAppIcon call with its own inline
            pseudo-app object instead of joining that list, per direct
            request: a widget icon "like Settings" — draggable by the
            same long-press-to-drag/short-press-to-open gesture
            DeskAppIcon already gives every app for free (see its own
            comment on the click-vs-drag distance threshold) — but a
            single click opens the X profile in a new tab rather than an
            app window. Its hover label ("@Nustalgio") uses the exact
            same light thought-tt treatment as every other desk icon's
            label (e.g. Settings' own "Settings") — no dark-variant
            styling here, since that was specifically for the wordmark's
            own "T" link sitting over Noir/Illust's dark backdrop
            (noir-background.tsx), not this cream-desk icon. */}
        {theme === 'default' && (
          <DeskAppIcon
            app={{ id: 'x-handle', label: '@Nustalgio' }}
            panX={canvas.offset.x}
            panY={canvas.offset.y}
            className={APP_ICON_POSITION['x-handle']}
            onOpen={() => window.open(X_HANDLE_URL, '_blank', 'noopener,noreferrer')}
            iconBackgroundImage={xWidgetBg.src}
          />
        )}

        {theme !== 'default' && (
          <button
            type="button"
            onClick={() => openApp('settings')}
            aria-label="Open Settings"
            className="fixed flex items-center justify-center rounded-2xl transition-transform hover:scale-105"
            style={{ top: dockTop(0), right: DOCK_GAP, width: DOCK_ICON_SIZE, height: DOCK_ICON_SIZE, background: '#282625' }}
          >
            {/* "On" indicator — per direct request, a small dot to the
                left of each Noir/Illust dock icon (this one, Calendar,
                DayCounter) whenever that widget's own window/panel is
                currently open. Absolutely positioned against this
                button's own box (the nearest positioned ancestor, since
                the button itself is `fixed`) rather than needing a
                separate wrapper element. */}
            {openApps.includes('settings') && (
              <span aria-hidden="true" className="absolute top-1/2 -left-2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-scroll-100" />
            )}
            <SettingsIcon size={18} className="text-scroll-100" />
          </button>
        )}

        <CalendarDeskWidget
          panX={canvas.offset.x}
          panY={canvas.offset.y}
          events={events}
          canEdit={canEdit}
          onEventsChange={setEvents}
          docked={theme === 'default' ? undefined : {
            open: calendarOpen,
            mounted: calendarMounted,
            visible: calendarVisible,
            dockTop: calendarDockTop,
            panelTop: calendarPanelTop,
            onOpenChange: setCalendarOpen,
          }}
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

        {/* Fourth dock slot, right below DayCounter, per direct request
            — plain link (not a button+window.open) so a real new-tab
            navigation works exactly like any other link (middle-click,
            ctrl/cmd-click, etc.), same reasoning as the wordmark's own
            "T" link. No hover LABEL here — per direct request, unlike the
            identical-looking Settings icon right above it, which
            likewise has none (aria-label is enough on both). Glyph is a
            plain chain-link mark (lucide's Link), not an X/Twitter brand
            mark — swapped in per direct request; its own 0.3 overlay is
            unchanged (an earlier pass hid the glyph until hover and
            darkened further on hover — replaced outright by a direct
            request before this one, not layered on top of it). Kept at
            this fixed slot regardless of whether
            `dayCounter` itself is null (the block just above is
            conditional on it) — "below the day counter" describes this
            icon's position in the dock's layout, not a runtime
            dependency on that data existing. */}
        {theme !== 'default' && (
          <a
            href={X_HANDLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Nustalgio on X"
            className="fixed flex items-center justify-center rounded-2xl transition-transform hover:scale-105"
            style={{
              top: xHandleDockTop, right: DOCK_GAP, width: DOCK_ICON_SIZE, height: DOCK_ICON_SIZE,
              // Flat rgba(0,0,0,0.3) layered as a second background-image
              // (a same-color-stop gradient, not an extra DOM element) —
              // same technique as the sticker desk's own X icon
              // (desk-app-icon.tsx), just its own 0.3 rather than that
              // one's 0.2.
              backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url(${xWidgetBg.src})`, backgroundSize: 'cover', backgroundPosition: 'center',
            }}
          >
            <LinkIcon size={16} className="text-scroll-100" />
          </a>
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
            {app.id === 'settings' && <SettingsPanel theme={theme} onThemeChange={setTheme} />}
          </DockAppWindow>
        )
      })}
    </>
  )
}
