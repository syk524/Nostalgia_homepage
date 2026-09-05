'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

// Lightweight "click an image to see it bigger" overlay — nothing this
// small already existed (post-modal.tsx is a full post-detail intercepted
// route, overkill for just enlarging one image). Click-outside (the
// backdrop itself, not the image) and Escape both close, matching the
// gesture post-modal.tsx already trains users to expect.
//
// Every click here stops propagation, including the two that close it —
// this renders as a child of whatever opened it (memo-card.tsx's tile,
// itself inside memo-board.tsx's board), and that board clears its own
// selection state on any click that reaches it. Without stopping it here,
// closing the lightbox would bubble straight through and deselect the
// tile underneath it, leaving no way back to that tile's own delete
// button — reported directly for an image-only memo, where the image is
// the entire tile and re-opens this same lightbox on the very click that
// would otherwise re-select it.
export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function close(e: React.MouseEvent) {
    e.stopPropagation()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/80 animate-fade-in"
      onClick={close}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
      >
        <X size={18} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary
          external/storage URL, no fixed dimensions to hand next/image */}
      <img
        src={src}
        alt=""
        onClick={e => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
      />
    </div>
  )
}
