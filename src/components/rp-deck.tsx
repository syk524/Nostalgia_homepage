'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { RpThumbnailPreview } from '@/components/rp-thumbnail-preview'
import type { RpPost } from '@/types/database'

export type ListedRpPost = Pick<RpPost, 'id' | 'title' | 'messages'>

// Height in vh, not a fixed px constant — per direct request ("65% of
// screen height", reference: phoneswitchmockup.framer.website), so the
// deck scales with the viewport instead of sitting at one fixed size.
// Width follows from the 3/4 aspect ratio every other thumbnail in the
// app already uses (TRPG's SessionCard, the old RP grid this replaced).
// Each card's own content is a rolling readout of the post's actual log
// (RpThumbnailPreview) rather than a cover_url photo — RpThumbnailPreview
// owns picking where it starts and advancing it from there; the deck
// only tells it which post's messages to show and whether it's active.
const CARD_HEIGHT_VH = 65
const SWIPE_THRESHOLD = 60
// How far the pointer has to move before a press counts as a drag rather
// than a click — was 8px, tight enough that ordinary click jitter (a
// trackpad or mouse cursor rarely stays pinned to the exact pixel
// between mousedown and mouseup) routinely got misread as a swipe,
// making onCardClick's preventDefault fire and silently swallow the
// click. Reported directly as "each post is not clickable." 24px keeps
// plenty of headroom below SWIPE_THRESHOLD (60px) so a real swipe still
// registers as one.
const DRAG_THRESHOLD = 24

// A single-thumbnail "skim" deck — only the active post is ever visible,
// crossfading to the next on swap, per direct request to drop the
// peeking previous/next neighbors the coverflow layout used to show.
// Every post still stays mounted (not conditionally rendered, just
// opacity/pointer-events toggled) so the crossfade has something to
// animate between instead of a hard cut, and so each post's own
// RpThumbnailPreview keeps rolling in the background rather than
// resetting every time you swipe back to it (reported directly — see
// that component's own comments). go() still wraps the index (last post
// loops to the first). Left/right drag (mouse or touch, via Pointer
// Events so both share one code path) swipes between posts, dragging
// only the visible active card since there's no neighbor to drag into
// view alongside it.
export function RpDeck({ posts }: { posts: ListedRpPost[] }) {
  const [index, setIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const dragXRef = useRef(0)
  const dragState = useRef<{ startX: number; dragging: boolean; moved: boolean } | null>(null)
  const count = posts.length

  function go(delta: number) {
    setIndex(i => (i + delta + count) % count)
  }

  // Tracked via window-level listeners added/removed here, not
  // setPointerCapture on the row div — capture would keep pointermove
  // reporting even if the cursor slides off whatever card is under it,
  // but it comes with a spec-mandated side effect: while a pointer is
  // captured, the browser retargets the click event that same gesture
  // produces to the CAPTURING element. Since the capturing element here
  // would be this row (an ANCESTOR of the actual Link cards), that
  // retargeted click bubbles from the ancestor upward and never reaches
  // — or passes through — the Link at all, so neither its onClick nor
  // its native navigation ever fires. Reported directly as "each post is
  // not clickable": confirmed live that a plain `element.click()` still
  // worked (it has no real pointer sequence to trigger capture in the
  // first place) while an actual mousedown→mouseup did not, and that
  // releasing capture from inside the pointerup handler was already too
  // late — the browser had decided the click's target before that
  // handler ran. Window listeners get the same "keep tracking outside
  // the element" behavior without going through capture at all.
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
  // active card's own Link navigation once the pointer lifts — captured
  // on the ref (not state) since the click event fires after the pointer
  // handlers above have already reset dragX for the next gesture. Only
  // the active card is ever clickable (others sit at pointer-events:
  // none), so there's no refocus-on-click branch to handle here anymore.
  function onCardClick(e: React.MouseEvent) {
    if (dragState.current?.moved) e.preventDefault()
  }

  if (!count) return null
  const active = posts[index]

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="relative w-full flex items-center justify-center select-none touch-pan-y cursor-grab active:cursor-grabbing"
        style={{ height: `${CARD_HEIGHT_VH}vh` }}
        onPointerDown={onPointerDown}
      >
        {posts.map((post, i) => {
          const isActive = i === index
          const dragging = dragState.current?.dragging ?? false

          // mask-image, not a solid-color overlay div — the ticker's own
          // background is transparent (it sits directly on the page, no
          // card panel behind it), so a color gradient would need to
          // match whatever's behind it (the grid pattern, which differs
          // by theme) to look right. A mask just fades the content's own
          // opacity, revealing more of whatever's actually behind it, so
          // it works regardless of background. Only the top fades — the
          // bottom, where new messages enter, should stay fully opaque so
          // an entering message isn't dimmed mid-arrival.
          const thumb = (
            <div
              className="relative overflow-hidden"
              style={{
                height: `${CARD_HEIGHT_VH}vh`,
                aspectRatio: '3 / 4',
                maskImage: 'linear-gradient(to bottom, transparent, black 14%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 14%)',
              }}
            >
              <RpThumbnailPreview messages={post.messages} active={isActive} />
            </div>
          )

          // Always the same element (a Link), active or not — a card
          // that switched between <Link> and <button> across renders (as
          // this used to) gets unmounted and remounted the instant its
          // active state flips, which breaks the crossfade transition for
          // exactly the two cards involved in every swap. Reported
          // directly as the swap "working weirdly" — one stable element
          // type per card lets the transition carry smoothly. dragX only
          // moves the active card (others are already invisible and stay
          // put) and is dropped the instant a gesture ends so the deck
          // snaps to its resting position instead of jumping.
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
              href={`/archive/rp/${post.id}`}
              onClick={onCardClick}
              tabIndex={isActive ? undefined : -1}
              className="absolute"
              style={style}
              draggable={false}
            >
              {thumb}
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
