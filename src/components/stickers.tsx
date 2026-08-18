'use client'
import { useRef } from 'react'
import { Sparkles } from 'lucide-react'
import { useDraggable } from '@/lib/use-draggable'

const CLICK_THRESHOLD = 4

// A small decorative "folder" sticker — flat at rest, tilts open on hover
// (perspective on the direct parent of the rotating cover, hinged at its
// left edge via origin-left) to reveal a paper sliver tucked behind it.
// Also freely draggable on its own (see useDraggable). panX/panY are the
// containing scene's own pan offset (see draggable-home-scene.tsx), added
// on top of this sticker's independent drag offset so it still travels
// with the rest of the "desk" when the background is panned. The
// pan+drag translate is the OUTERMOST transform function — applied last,
// in plain screen pixels — so mouse movement tracks 1:1 regardless of
// this card's own -3deg rotation/0.8 scale, which live further in.
export function Stickers({ panX = 0, panY = 0, onOpenGallery }: { panX?: number; panY?: number; onOpenGallery?: () => void }) {
  const drag = useDraggable()
  const downPos = useRef<{ x: number; y: number } | null>(null)

  function handlePointerDown(e: React.PointerEvent) {
    downPos.current = { x: e.clientX, y: e.clientY }
    drag.handlers.onPointerDown(e)
  }

  // A plain click and the start of a drag look identical at pointerdown —
  // only pointerup tells them apart, by how far the pointer actually
  // travelled. Below the threshold it's a click (open the gallery);
  // above it, useDraggable already moved the folder and no click should
  // fire on top of that.
  function handlePointerUp(e: React.PointerEvent) {
    drag.handlers.onPointerUp()
    const start = downPos.current
    downPos.current = null
    if (!start || !onOpenGallery) return
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < CLICK_THRESHOLD) onOpenGallery()
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={drag.handlers.onPointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={drag.handlers.onPointerCancel}
      className={`group hidden md:block absolute right-[8%] top-1/2 touch-none ${drag.dragging ? 'cursor-grabbing' : 'cursor-grab'} ${onOpenGallery ? 'cursor-pointer' : ''}`}
      style={{ transform: `translate(${panX + drag.offset.x}px, ${panY + drag.offset.y}px) translateY(-50%) rotate(-3deg) scale(0.8)` }}
    >
      {/* thought-tt-wrap goes on this inner wrapper rather than the
          outer positioned element above — its own position:relative /
          display:inline-block would otherwise fight the outer div's
          Tailwind absolute/hidden-md:block classes (a plain-class vs
          plain-class conflict that isn't reliably decided in our
          favor, unlike desk-app-icon.tsx's trigger, which sets
          position:absolute via inline style and so always wins). */}
      <div className="thought-tt-wrap">
        <div className="relative w-[150px] h-[190px]" style={{ perspective: 900 }}>
          {/* Paper tucked behind the cover — only its right edge (a vertical
              label) is meant to peek out once the cover rotates away. */}
          <div className="absolute inset-0 rounded-xl bg-scroll-50 border border-scroll-300 shadow-parchment flex items-center justify-end pr-2.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ink-400 [writing-mode:vertical-rl]">
              Do not open
            </span>
          </div>

          {/* Folder cover — hinges open on hover, staying flat at rest. */}
          <div
            className="thought-tt-trigger absolute inset-0 rounded-xl shadow-parchment p-4 flex flex-col justify-between origin-left transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:[transform:rotateY(-26deg)]"
            style={{ background: '#5B574E' }}
          >
            <Sparkles size={18} className="text-scroll-100" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-scroll-100">Sticker Board</p>
            </div>
          </div>
        </div>
        <span className="thought-tt font-sans text-[9px] uppercase tracking-wide">Sticker</span>
      </div>
    </div>
  )
}
