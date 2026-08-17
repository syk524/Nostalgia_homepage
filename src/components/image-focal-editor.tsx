'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const TARGET_ASPECT = 16 / 9

// Reframes where a 16:9 thumbnail crop lands on this image — stored as a
// focal-window position (%, %) along whichever axis the crop actually slides
// on (this is exactly what CSS object-position's percentage means), not an
// actual crop, so the original file is untouched and the same image can
// still show in full elsewhere (post detail, modal).
export function ImageFocalEditor({
  src, initialX, initialY, onSave, onClose,
}: {
  src: string
  initialX: number
  initialY: number
  onSave: (x: number, y: number) => void
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(initialX)
  const [y, setY] = useState(initialY)
  const [aspect, setAspect] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  // Portal straight onto <body> — this editor opens nested inside the New/
  // Edit Post forms, whose ancestors carry animate-fade-up/slide-up classes.
  // Those animations use fill-mode "both", which leaves a permanent (if
  // identity) transform on the element even after it finishes — and any
  // transform on an ancestor turns it into the containing block for our
  // fixed-position overlay below, trapping it inside that card's box instead
  // of the real viewport. Rendering on body sidesteps the whole chain.
  useEffect(() => setMounted(true), [])

  const slideAxis = aspect === null ? null : aspect > TARGET_ASPECT ? 'x' : 'y'
  // The non-sliding axis is pinned full-size (100%) — that dimension is
  // exactly covered already, so there's nowhere for the crop to slide.
  const frameWidthPct = slideAxis === 'x' ? (TARGET_ASPECT / (aspect as number)) * 100 : 100
  const frameHeightPct = slideAxis === 'y' ? ((aspect as number) / TARGET_ASPECT) * 100 : 100
  const frameLeftPct = slideAxis === 'x' ? (x / 100) * (100 - frameWidthPct) : 0
  const frameTopPct = slideAxis === 'y' ? (y / 100) * (100 - frameHeightPct) : 0

  function updateFromPoint(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height || !slideAxis) return
    if (slideAxis === 'x') {
      const range = 100 - frameWidthPct
      if (range <= 0) return
      const centerPct = ((clientX - rect.left) / rect.width) * 100
      const leftPct = Math.min(range, Math.max(0, centerPct - frameWidthPct / 2))
      setX(Math.round((leftPct / range) * 100))
    } else {
      const range = 100 - frameHeightPct
      if (range <= 0) return
      const centerPct = ((clientY - rect.top) / rect.height) * 100
      const topPct = Math.min(range, Math.max(0, centerPct - frameHeightPct / 2))
      setY(Math.round((topPct / range) * 100))
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromPoint(e.clientX, e.clientY)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (e.buttons !== 1) return
    updateFromPoint(e.clientX, e.clientY)
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 backdrop-blur-sm p-6 overflow-y-auto" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 space-y-5 my-auto max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Image is capped to max-h-[45vh] so tall/portrait images shrink to
            fit instead of blowing out the modal's height — the container
            sizes itself to the rendered image box (inline-block, no
            stretching), so the crop frame's % positioning below lines up
            with the image exactly regardless of how small it got scaled. */}
        <div className="flex justify-center">
          <div
            ref={containerRef}
            className="relative inline-block max-w-full overflow-hidden rounded touch-none select-none cursor-move"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
          >
            <img
              src={src}
              alt=""
              className="block max-h-[45vh] max-w-full w-auto h-auto pointer-events-none"
              draggable={false}
              onLoad={e => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
            />
            {slideAxis && (
              <div
                className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none"
                style={{
                  left: `${frameLeftPct}%`,
                  top: `${frameTopPct}%`,
                  width: `${frameWidthPct}%`,
                  height: `${frameHeightPct}%`,
                }}
              />
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={() => onSave(x, y)}>Save</button>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
