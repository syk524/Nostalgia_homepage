'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { X, Pencil, Loader2, Hourglass } from 'lucide-react'
import { usePersistentDraggable } from '@/lib/use-persistent-draggable'
import { DayCounterDockIcon, dayCount } from './day-counter-dock-icon'
import { updateDayCounter } from '@/lib/actions/day-counter'
import { uploadImage } from '@/lib/upload'
import { createClient } from '@/lib/supabase/client'
import { PAIR_FONTS, pairFontFamily } from '@/lib/fonts'
import type { DayCounter } from '@/types/database'

const ICON_SIZE = 44
const PANEL_WIDTH = 360
const PANEL_HEIGHT = 120
const EDIT_HEIGHT = 340
const OPEN_STORAGE_KEY = 'day-counter-desk-widget-open'

// Defaults to open — a first-time visitor (nothing stored yet) sees the
// panel already expanded; only an explicit close ('0') keeps it shut on
// the next visit.
function readStoredOpen(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(OPEN_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

// Same desk-widget shape as CalendarDeskWidget: draggable, pans with the
// canvas, morphs in place between a small icon and a full panel (see
// .desk-widget-box/-icon-face/-panel-face in globals.css — both faces
// stay mounted and cross-fade rather than one hard-swapping for the
// other), position handled separately via the drag offset, with both
// position and open/closed state persisted per browser. Editing
// (photo/text color/font) temporarily grows the panel to EDIT_HEIGHT
// rather than trying to cram a form into the display card's own 120px —
// the 360×120 footprint is a display-mode spec, not a hard cap on every
// state this widget can be in. None of this morph-in-place applies when
// `docked` — see that prop for why.
export function DayCounterDeskWidget({ panX, panY, dayCounter, canEdit, onDayCounterChange, docked }: {
  panX: number
  panY: number
  dayCounter: DayCounter
  canEdit: boolean
  onDayCounterChange: (d: DayCounter) => void
  // Set on a non-default theme (see draggable-home-scene.tsx) — see the
  // identical prop on CalendarDeskWidget for the full reasoning. Unlike
  // the default theme's icon-morphs-into-panel behavior, a docked
  // widget keeps a plain, fixed trigger icon in the right-edge dock
  // (dockTop, never resizing) and opens the actual panel as a separate
  // element pinned to the top-left of the screen (panelTop, recomputed
  // by the parent relative to Calendar's own open state).
  docked?: { open: boolean; dockTop: string; panelTop: string; onOpenChange: (open: boolean) => void }
}) {
  // Offset well clear of the calendar widget's own default (420, -140)
  // so the two don't land stacked on first load.
  const drag = usePersistentDraggable('day-counter-desk-widget', { x: 560, y: -140 })
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const downPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    setOpen(readStoredOpen())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(OPEN_STORAGE_KEY, open ? '1' : '0') } catch {
      // Storage unavailable — the toggle still works, just won't be remembered.
    }
  }, [open, hydrated])

  const [editing, setEditing] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState(dayCounter.photo_url ?? '')
  const [textColor, setTextColor] = useState(dayCounter.text_color)
  const [font, setFont] = useState(dayCounter.font)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleIconPointerDown(e: React.PointerEvent) {
    downPos.current = { x: e.clientX, y: e.clientY }
    drag.handlers.onPointerDown(e)
  }
  function handleIconPointerUp(e: React.PointerEvent) {
    drag.handlers.onPointerUp()
    const start = downPos.current
    downPos.current = null
    if (!start) return
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4) setOpen(true)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function startEditing() {
    setPhotoFile(null)
    setPhotoPreview(dayCounter.photo_url ?? '')
    setTextColor(dayCounter.text_color)
    setFont(dayCounter.font)
    setError('')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    let finalPhotoUrl = dayCounter.photo_url
    let finalPhotoPath = dayCounter.photo_path
    if (photoFile) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('You must be signed in.'); setSaving(false); return }
      const { url, path, error: uploadErr } = await uploadImage(photoFile, user.id, 'day-counter-photos')
      if (uploadErr || !url) { setError(uploadErr ?? 'Upload failed.'); setSaving(false); return }
      finalPhotoUrl = url
      finalPhotoPath = path
    }

    const { error: err } = await updateDayCounter(dayCounter.id, {
      photoUrl: finalPhotoUrl,
      photoPath: finalPhotoPath,
      textColor,
      font,
      // Only ever set when this save is actually swapping in a new
      // photo — the server action deletes it from storage once the new
      // one is safely saved, so the old file doesn't linger forever.
      oldPhotoPath: photoFile ? dayCounter.photo_path : null,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onDayCounterChange({ ...dayCounter, photo_url: finalPhotoUrl, photo_path: finalPhotoPath, text_color: textColor, font })
    setEditing(false)
  }

  if (!hydrated) return null

  const n = dayCount()
  const panelHeight = editing ? EDIT_HEIGHT : PANEL_HEIGHT

  // Shared between the default theme's in-place panel face and the
  // docked theme's standalone top-left panel — only the outer wrapper
  // (and its width/height) differs between the two.
  const panelInner = editing ? (
    <div className="flex flex-col h-full">
      <div
        {...(docked ? {} : drag.handlers)}
        className={`flex items-center justify-between gap-2 px-4 py-2.5 shrink-0 touch-none border-b border-scroll-300 bg-scroll-200 ${!docked && drag.dragging ? 'cursor-grabbing' : docked ? '' : 'cursor-grab'}`}
      >
        <div className="flex items-center gap-1.5">
          <Hourglass size={13} className="text-[#5B574E]" />
          <h2 className="font-sans text-[11px] uppercase tracking-[0.2em] text-[#5B574E]">Edit Day Counter</h2>
        </div>
        <button
          type="button"
          onClick={() => setEditing(false)}
          onPointerDown={e => e.stopPropagation()}
          aria-label="Cancel"
          className="text-ink-400 hover:text-ink-600"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <div>
          <label className="label !text-ink-400">Photo</label>
          <div className="flex items-center gap-3">
            <div className="w-20 h-14 rounded border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
              {photoPreview
                ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                : <span className="text-xl text-scroll-400">◯</span>
              }
            </div>
            <label className="btn-ghost text-xs cursor-pointer">
              Choose image
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
            </label>
          </div>
        </div>

        <div>
          <label className="label !text-ink-400">Text color</label>
          <input
            type="color"
            value={textColor}
            onChange={e => setTextColor(e.target.value)}
            aria-label="Text color"
            className="h-10 w-10 rounded-full border border-scroll-300 cursor-pointer"
          />
        </div>

        <div>
          <label className="label !text-ink-400">Font</label>
          <select
            className="input"
            value={font}
            onChange={e => setFont(e.target.value)}
            style={{ fontFamily: pairFontFamily(font) }}
          >
            {Object.entries(PAIR_FONTS).map(([key, { label, family }]) => (
              <option key={key} value={key} style={{ fontFamily: family }}>{label}</option>
            ))}
          </select>
        </div>

        {error && <p className="field-error">{error}</p>}
      </div>

      <div className="flex gap-2 justify-end p-4 pt-0 shrink-0">
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost text-xs">Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-xs">
          {saving ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
        </button>
      </div>
    </div>
  ) : (
    <div
      {...(docked ? {} : drag.handlers)}
      className={`relative w-full h-full touch-none ${!docked && drag.dragging ? 'cursor-grabbing' : docked ? '' : 'cursor-grab'}`}
      style={{ background: '#282625' }}
    >
      {dayCounter.photo_url && (
        <Image src={dayCounter.photo_url} alt="" fill sizes={`${PANEL_WIDTH}px`} className="object-cover" />
      )}
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative h-full flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0" style={{ fontFamily: pairFontFamily(dayCounter.font) }}>
            <p className="text-3xl font-bold leading-none" style={{ color: dayCounter.text_color }}>
              D+{n}
            </p>
            <p className="text-sm mt-1 opacity-80" style={{ color: dayCounter.text_color }}>
              Nustalgio
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={startEditing}
                onPointerDown={e => e.stopPropagation()}
                aria-label="Edit day counter"
                className="text-scroll-100/70 hover:text-scroll-100"
              >
                <Pencil size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => docked ? docked.onOpenChange(false) : setOpen(false)}
              onPointerDown={e => e.stopPropagation()}
              aria-label="Close"
              className="text-scroll-100/70 hover:text-scroll-100"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (docked) {
    return (
      <>
        <button
          type="button"
          onClick={() => docked.onOpenChange(!docked.open)}
          aria-label={docked.open ? 'Close Day Counter' : 'Open Day Counter'}
          className="fixed flex items-center justify-center rounded-2xl overflow-hidden"
          style={{ top: docked.dockTop, right: 16, width: ICON_SIZE, height: ICON_SIZE, background: '#282625' }}
        >
          <DayCounterDockIcon
            size={ICON_SIZE}
            photoUrl={dayCounter.photo_url}
            font={dayCounter.font}
            textColor={dayCounter.text_color}
          />
        </button>

        {docked.open && (
          <div
            className="fixed rounded-xl bg-scroll-50 overflow-hidden animate-fade-up"
            style={{ top: docked.panelTop, left: 16, width: PANEL_WIDTH, height: panelHeight, transition: 'top 400ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            {panelInner}
          </div>
        )}
      </>
    )
  }

  return (
    <div
      className="absolute left-0 bottom-0 touch-none"
      style={{ transform: `translate(${panX + drag.offset.x}px, ${panY + drag.offset.y}px)` }}
    >
      <div
        className={`desk-widget-box absolute left-0 top-0 rounded-xl bg-scroll-50 overflow-hidden ${open ? 'is-open' : 'border border-scroll-300'}`}
        style={{
          width: open ? PANEL_WIDTH : ICON_SIZE,
          height: open ? panelHeight : ICON_SIZE,
        }}
      >
        {/* Both faces stay mounted at all times and cross-fade via CSS
            (.desk-widget-icon-face/-panel-face in globals.css) instead
            of one hard-swapping for the other — see that rule's own
            comment for why. */}
        <div
          onPointerDown={handleIconPointerDown}
          onPointerMove={drag.handlers.onPointerMove}
          onPointerUp={handleIconPointerUp}
          onPointerCancel={drag.handlers.onPointerCancel}
          className={`desk-widget-icon-face absolute inset-0 touch-none ${drag.dragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
        >
          <DayCounterDockIcon
            size={ICON_SIZE}
            photoUrl={dayCounter.photo_url}
            font={dayCounter.font}
            textColor={dayCounter.text_color}
          />
        </div>

        {/* Stops pointerdown from bubbling to the desk canvas's own pan
            gesture — same click-hijack fix as the calendar widget. */}
        <div
          className="desk-widget-panel-face absolute inset-0"
          style={{ width: PANEL_WIDTH, height: panelHeight }}
          onPointerDown={e => e.stopPropagation()}
        >
          {panelInner}
        </div>
      </div>
    </div>
  )
}
