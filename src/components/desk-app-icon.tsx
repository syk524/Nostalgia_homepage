'use client'
import { useRef } from 'react'
import { useDraggable } from '@/lib/use-draggable'
import type { DockApp } from '@/lib/dock-apps'

const CLICK_THRESHOLD = 4
const SIZE = 44

// One of the dock's former bar icons, now a freestanding object on the
// desk — draggable exactly like the sticker folder (see stickers.tsx):
// ephemeral position that resets on reload, click-vs-drag disambiguated
// by how far the pointer actually travelled between down and up. Unlike
// a placed sticker, there's no delete affordance here — these are
// permanent app launchers, not user content, so nothing to remove.
// panX/panY are the containing scene's pan offset, added on top of this
// icon's own drag offset so it still travels with the rest of the desk.
export function DeskAppIcon({ app, panX, panY, className, onOpen, iconBackgroundImage, iconSize = 18 }: {
  app: DockApp
  panX: number
  panY: number
  className: string
  onOpen: () => void
  // Every app so far used the same flat #282625 chip behind its glyph —
  // optional so Settings (and any future plain app) needs no change at
  // all, only set for the X-handle widget (draggable-home-scene.tsx),
  // which wants its own branded artwork behind the X mark instead.
  iconBackgroundImage?: string
  // Defaults to Settings' own glyph size — X-handle overrides this
  // smaller, per direct request, since its glyph reads as oversized next
  // to Settings' gear at the shared default.
  iconSize?: number
}) {
  const drag = useDraggable()
  const downPos = useRef<{ x: number; y: number } | null>(null)

  function handlePointerDown(e: React.PointerEvent) {
    downPos.current = { x: e.clientX, y: e.clientY }
    drag.handlers.onPointerDown(e)
  }

  function handlePointerUp(e: React.PointerEvent) {
    drag.handlers.onPointerUp()
    const start = downPos.current
    downPos.current = null
    if (!start) return
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < CLICK_THRESHOLD) onOpen()
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={drag.handlers.onPointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={drag.handlers.onPointerCancel}
      className={`thought-tt-wrap touch-none ${drag.dragging ? 'cursor-grabbing' : 'cursor-pointer'} ${className}`}
      style={{ position: 'absolute', transform: `translate(${panX + drag.offset.x}px, ${panY + drag.offset.y}px)` }}
    >
      <div
        className="thought-tt-trigger flex items-center justify-center rounded-2xl overflow-hidden select-none"
        style={iconBackgroundImage
          // A flat rgba(0,0,0,0.2) layered as a second background-image
          // (a same-color-stop gradient, not an extra DOM element) rather
          // than a separate overlay div — a glyph would render above both
          // of a single element's own background layers via normal
          // painting order with no z-index of its own needed, but doesn't
          // touch the flat-color branch's own rendering at all.
          ? { width: SIZE, height: SIZE, backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)), url(${iconBackgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { width: SIZE, height: SIZE, background: '#282625' }}
      >
        {/* Optional — the X-handle widget dropped its glyph per direct
            request, leaving just its own background artwork+overlay to
            represent it. */}
        {app.icon && <app.icon size={iconSize} className="text-scroll-100" />}
      </div>
      <span className="thought-tt font-sans text-[9px] uppercase tracking-wide">{app.label}</span>
    </div>
  )
}
