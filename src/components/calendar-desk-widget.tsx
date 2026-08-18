'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Globe, Users, Lock, Plus, Loader2, CalendarDays } from 'lucide-react'
import { usePersistentDraggable } from '@/lib/use-persistent-draggable'
import { CalendarDockIcon } from './calendar-dock-icon'
import { addEvent, deleteEvent } from '@/lib/actions/calendar'
import type { CalendarEvent, EventVisibility } from '@/types/database'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const VISIBILITY_META: Record<EventVisibility, { label: string; icon: typeof Globe }> = {
  public: { label: 'Public', icon: Globe },
  members: { label: 'Members', icon: Users },
  private: { label: 'Private', icon: Lock },
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type GridDay = { date: Date; iso: string; inMonth: boolean }

function buildMonthGrid(viewYear: number, viewMonth: number): GridDay[] {
  const first = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const leading = first.getDay()
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7

  const days: GridDay[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - leading + 1
    const date = new Date(viewYear, viewMonth, dayNum)
    days.push({ date, iso: toISODate(date), inMonth: date.getMonth() === viewMonth })
  }
  return days
}

const ICON_SIZE = 44
const PANEL_WIDTH = 560
const PANEL_HEIGHT = 400
const OPEN_STORAGE_KEY = 'calendar-desk-widget-open'

function readStoredOpen(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(OPEN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// The calendar lives on the desk like the sticker folder — draggable,
// pans with the canvas — but instead of opening a separate window it
// morphs in place: the same box tweens its own width/height between the
// small icon and the full panel (only width/height transition, per the
// user's reference — position is handled separately via the drag
// offset, so the two never fight each other). The sizing box is
// centered on the drag anchor via top/left 50% + translate(-50%,-50%),
// which CSS recomputes every frame against the box's current (animating)
// size — so it grows and shrinks symmetrically around a fixed center
// point, the spot you dragged it to, rather than from a corner. Both
// position and open/closed state persist per browser (localStorage) —
// if you leave it open, it reopens open next time; if you close it, it
// reopens as just the icon.
export function CalendarDeskWidget({ panX, panY, events, canEdit, onEventsChange }: {
  panX: number
  panY: number
  events: CalendarEvent[]
  canEdit: boolean
  onEventsChange: (events: CalendarEvent[]) => void
}) {
  // Anchored from the desk's own bottom-left corner (see the wrapper's
  // left-0 bottom-0 below), so the default offset has to shift it well
  // clear of that corner — otherwise it lands right on top of Nav's own
  // bottom-left avatar/login chip. Roughly where the old dock icon sat.
  const drag = usePersistentDraggable('calendar-desk-widget', { x: 420, y: -140 })
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const downPos = useRef<{ x: number; y: number } | null>(null)

  // Read the persisted open state only after mount — matches
  // usePersistentDraggable's own SSR-safe pattern (this never runs
  // during the server render, so there's no hydration mismatch to
  // guard against, just a one-frame default-closed flash avoided by
  // not rendering until we know).
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

  const today = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedIso, setSelectedIso] = useState(toISODate(today))
  const [addingOpen, setAddingOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [dotColor, setDotColor] = useState('#5B574E')
  const [visibility, setVisibility] = useState<EventVisibility>('public')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const todayIso = toISODate(today)
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const list = map.get(ev.event_date) ?? []
      list.push(ev)
      map.set(ev.event_date, list)
    }
    return map
  }, [events])

  const selectedEvents = eventsByDay.get(selectedIso) ?? []

  function changeMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  function selectDay(day: GridDay) {
    setSelectedIso(day.iso)
    setAddingOpen(false)
    if (!day.inMonth) { setViewYear(day.date.getFullYear()); setViewMonth(day.date.getMonth()) }
  }

  async function handleAdd() {
    if (!title.trim()) { setError('Give the event a title.'); return }
    setError('')
    setSaving(true)
    const { event, error: err } = await addEvent({ date: selectedIso, title, dotColor, visibility })
    setSaving(false)
    if (!event) { setError(err ?? 'Could not add the event.'); return }
    onEventsChange([...events, event])
    setTitle('')
    setDotColor('#5B574E')
    setVisibility('public')
    setAddingOpen(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const { error: err } = await deleteEvent(id)
    setDeletingId(null)
    if (err) { setError(err); return }
    onEventsChange(events.filter(e => e.id !== id))
  }

  // Icon-state click-vs-drag: same movement-distance disambiguation as
  // the folder and the other desk icons.
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

  if (!hydrated) return null

  return (
    <div
      className="absolute left-0 bottom-0 touch-none"
      style={{ transform: `translate(${panX + drag.offset.x}px, ${panY + drag.offset.y}px)` }}
    >
      <div
        className="absolute left-0 top-0 rounded-xl border border-scroll-300 bg-scroll-50 overflow-hidden"
        style={{
          width: open ? PANEL_WIDTH : ICON_SIZE,
          height: open ? PANEL_HEIGHT : ICON_SIZE,
          transition: 'width 300ms cubic-bezier(0.22, 1, 0.36, 1), height 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {open ? (
          // Stops pointerdown from bubbling to the desk canvas's own
          // onPointerDown (which starts a pan gesture and captures the
          // pointer, per the same bug the sticker gallery modal hit
          // earlier). The header/icon already dodge this because their
          // own drag handlers call stopPropagation, but plain buttons in
          // the body — day cells, Add event, nav arrows — had nothing
          // stopping their clicks from being hijacked.
          <div
            className="absolute inset-0 flex flex-col"
            style={{ width: PANEL_WIDTH, height: PANEL_HEIGHT }}
            onPointerDown={e => e.stopPropagation()}
          >
            <div
              {...drag.handlers}
              className={`flex items-center justify-between gap-2 px-4 py-2.5 shrink-0 touch-none border-b border-scroll-300 bg-scroll-200 ${drag.dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
              <div className="flex items-center gap-1.5">
                <CalendarDays size={13} className="text-[#5B574E]" />
                <h2 className="font-sans text-[11px] uppercase tracking-[0.2em] text-[#5B574E]">Calendar</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                onPointerDown={e => e.stopPropagation()}
                aria-label="Close"
                className="text-ink-400 hover:text-ink-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-1 min-h-0">
              <div className="w-[300px] shrink-0 p-5 border-r border-scroll-300 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-sans text-sm text-[#5B574E]">{MONTH_NAMES[viewMonth]} {viewYear}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="text-ink-400 hover:text-ink-600">
                      <ChevronLeft size={16} />
                    </button>
                    <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="text-ink-400 hover:text-ink-600">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-y-1 text-center">
                  {WEEKDAYS.map((w, i) => (
                    <span key={i} className="font-sans text-[9px] uppercase text-ink-400 py-1">{w}</span>
                  ))}
                  {grid.map(day => {
                    const dayEvents = eventsByDay.get(day.iso) ?? []
                    const isSelected = day.iso === selectedIso
                    const isToday = day.iso === todayIso
                    return (
                      <button
                        key={day.iso}
                        type="button"
                        onClick={() => selectDay(day)}
                        className={`relative aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 text-xs font-sans transition-colors
                          ${isSelected ? 'bg-[#5B574E] text-scroll-100' : 'hover:bg-scroll-200 text-[#5B574E]'}
                          ${!day.inMonth ? 'opacity-30' : ''}
                          ${isToday && !isSelected ? 'border border-ink-500/40' : ''}`}
                      >
                        {day.date.getDate()}
                        <span className="flex gap-[2px] h-[3px]">
                          {dayEvents.slice(0, 3).map((ev, i) => (
                            <span key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: ev.dot_color }} />
                          ))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex-1 min-w-0 p-5 flex flex-col overflow-y-auto">
                <h3 className="font-sans text-sm text-[#5B574E] mb-3">
                  {new Date(selectedIso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>

                {error && <p className="field-error mb-2">{error}</p>}

                <div className="space-y-2 mb-3">
                  {selectedEvents.length === 0 && <p className="text-[11px] font-sans text-ink-400">No events.</p>}
                  {selectedEvents.map(ev => {
                    const Meta = VISIBILITY_META[ev.visibility]
                    return (
                      <div key={ev.id} className="group flex items-center gap-2 px-3 py-2 rounded border border-scroll-300 bg-scroll-50">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ev.dot_color }} />
                        <span className="flex-1 text-sm text-[#5B574E] truncate">{ev.title}</span>
                        <Meta.icon size={12} className="text-ink-400 shrink-0" />
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleDelete(ev.id)}
                            disabled={deletingId === ev.id}
                            aria-label={`Remove ${ev.title}`}
                            className="shrink-0 opacity-0 group-hover:opacity-100 text-ink-400 hover:text-ember transition-opacity"
                          >
                            {deletingId === ev.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {canEdit && !addingOpen && (
                  <button type="button" onClick={() => setAddingOpen(true)} className="btn-ghost text-xs self-start">
                    <Plus size={13} /> Add event
                  </button>
                )}

                {canEdit && addingOpen && (
                  <div className="border border-scroll-300 rounded-lg p-3 space-y-2.5">
                    <input
                      className="input text-sm"
                      placeholder="Event title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {(Object.keys(VISIBILITY_META) as EventVisibility[]).map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setVisibility(v)}
                            className={`pill ${visibility === v ? 'pill-active' : ''}`}
                          >
                            {VISIBILITY_META[v].label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="color"
                        value={dotColor}
                        onChange={e => setDotColor(e.target.value)}
                        aria-label="Dot color"
                        className="h-8 w-8 rounded border border-scroll-300 cursor-pointer shrink-0"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setAddingOpen(false)} className="btn-ghost text-xs">Cancel</button>
                      <button type="button" onClick={handleAdd} disabled={saving} className="btn-primary text-xs">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div
            onPointerDown={handleIconPointerDown}
            onPointerMove={drag.handlers.onPointerMove}
            onPointerUp={handleIconPointerUp}
            onPointerCancel={drag.handlers.onPointerCancel}
            className={`absolute inset-0 touch-none ${drag.dragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
          >
            <CalendarDockIcon size={ICON_SIZE} />
          </div>
        )}
      </div>
    </div>
  )
}
