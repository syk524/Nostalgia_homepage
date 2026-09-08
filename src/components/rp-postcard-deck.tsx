'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { RpPostcardPreview } from '@/components/rp-postcard-preview'
import type { RpPost } from '@/types/database'

export type ListedRpPost = Pick<RpPost, 'id' | 'title' | 'slug' | 'messages'>

// Postcard-shaped (landscape) rather than the portrait 3/4 card the
// rolling-chat version used. Both dimensions are fixed here — not just
// the width — per direct request ("fix the postcard height across
// posts"): the card used to size itself to whatever excerpt it was
// showing, which meant its height differed post to post (and even
// re-roll to re-roll on the same post). RpPostcardPreview now shrinks
// its OWN content to fit this fixed box instead of the box growing for
// the content.
const CARD_WIDTH = 'clamp(340px, 94vw, 780px)'
// Height is set via the --rp-card-h custom property in the JSX below
// (Tailwind's [--rp-card-h:...] arbitrary-property classes), not this
// constant — Tailwind's static scanner can't see a class built from a
// template literal, which is exactly what silently zeroed the deck's
// height the first time this was tried (var(--rp-card-h) resolved to
// nothing, collapsing every Link card to height 0 and hiding the stamp
// entirely). Kept as a comment-only reference so the two values below
// (mobile 320px fixed; min-[520px] clamp(230px,58vw,440px), unchanged
// from the original desktop sizing) have one documented source of truth
// even though they can't be threaded through this constant in code.
const SWIPE_THRESHOLD = 60
// See rp-deck.tsx's own copy of this constant for the full story on why
// this isn't smaller — an overly tight threshold made ordinary click
// jitter register as a swipe and silently swallow the click.
const DRAG_THRESHOLD = 24

// A "back pocket" sibling of rp-deck.tsx (kept fully intact, unused, in
// case this new postcard visualization doesn't work out — per direct
// request not to delete it) rather than a modification of it: same
// swipe/click/drag machinery (including the pointer-capture-vs-click fix
// documented in onPointerDown below) and single-thumbnail crossfade
// (peeking-neighbor coverflow was tried and then reverted, per direct
// request), rendering RpPostcardPreview instead of RpThumbnailPreview.
export function RpPostcardDeck({ posts }: { posts: ListedRpPost[] }) {
  const [index, setIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const dragXRef = useRef(0)
  const dragState = useRef<{ startX: number; dragging: boolean; moved: boolean } | null>(null)
  const count = posts.length

  function go(delta: number) {
    setIndex(i => (i + delta + count) % count)
  }

  // Tracked via window-level listeners, not setPointerCapture on the row
  // div — see rp-deck.tsx's own onPointerDown for the full explanation:
  // capture retargets the click event this same gesture produces to the
  // CAPTURING element (an ancestor of the actual Link cards here), which
  // silently breaks click-to-open for a real mousedown→mouseup.
  function onPointerDown(e: React.PointerEvent) {
    if (count < 2) return
    const startX = e.clientX
    dragState.current = { startX, dragging: true, moved: false }
    setDragX(0)

    function onMove(ev: PointerEvent) {
      const state = dragState.current
      if (!state?.dragging) return
      const delta = ev.clientX - state.startX
      if (Math.abs(delta) > DRAG_THRESHOLD) state.moved = true
      dragXRef.current = delta
      setDragX(delta)
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const state = dragState.current
      if (state?.dragging) {
        if (dragXRef.current < -SWIPE_THRESHOLD) go(1)
        else if (dragXRef.current > SWIPE_THRESHOLD) go(-1)
        dragState.current = { ...state, dragging: false }
      }
      dragXRef.current = 0
      setDragX(0)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // A swipe that dragged past DRAG_THRESHOLD shouldn't also fire the
  // active card's own Link navigation once the pointer lifts. Only the
  // active card is ever clickable (others sit at pointer-events: none).
  function onCardClick(e: React.MouseEvent) {
    if (dragState.current?.moved) e.preventDefault()
  }

  if (!count) return null
  const active = posts[index]

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="relative flex items-center justify-center select-none touch-pan-y cursor-grab active:cursor-grabbing [--rp-card-h:320px] min-[520px]:[--rp-card-h:clamp(230px,58vw,440px)]"
        style={{ width: CARD_WIDTH, height: 'var(--rp-card-h)' }}
        onPointerDown={onPointerDown}
      >
        {posts.map((post, i) => {
          const isActive = i === index
          const dragging = dragState.current?.dragging ?? false

          const style: React.CSSProperties = {
            transform: `translateX(${isActive && dragging ? dragX : 0}px)`,
            zIndex: isActive ? 1 : 0,
            opacity: isActive ? 1 : 0,
            pointerEvents: isActive ? 'auto' : 'none',
            transition: dragging ? 'none' : 'transform 280ms ease-out, opacity 280ms ease-out',
          }

          return (
            <Link
              key={post.id}
              href={`/archive/rp/${post.slug}`}
              onClick={onCardClick}
              tabIndex={isActive ? undefined : -1}
              className="absolute inset-0"
              style={style}
              draggable={false}
            >
              <RpPostcardPreview title={post.title} messages={post.messages} index={i} total={count} active={isActive} />
            </Link>
          )
        })}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous"
          disabled={count < 2}
          className="w-8 h-8 rounded-full flex items-center justify-center text-ink-400 hover:text-ink noir-accent-color transition-colors disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1.5">
          {posts.map((post, i) => (
            <button key={post.id} type="button" onClick={() => setIndex(i)} aria-label={`Go to ${post.title}`} className="p-1">
              <span
                className="block w-1.5 h-1.5 rounded-full transition-opacity"
                style={{ backgroundColor: 'var(--theme-accent)', opacity: i === index ? 1 : 0.3 }}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next"
          disabled={count < 2}
          className="w-8 h-8 rounded-full flex items-center justify-center text-ink-400 hover:text-ink noir-accent-color transition-colors disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <p
        className="text-center text-[15px] tracking-[0.02em]"
        style={{ fontFamily: 'var(--font-chosun-nm), Georgia, serif', color: 'var(--theme-accent)' }}
      >
        {active.title}
      </p>
    </div>
  )
}
