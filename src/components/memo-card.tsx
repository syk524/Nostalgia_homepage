'use client'
import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import { GripHorizontal, X } from 'lucide-react'
import type { Memo } from '@/types/database'

const URL_PATTERN = /(https?:\/\/[^\s]+)/g

// Splits read-only display text on bare URLs and renders each as a real
// link — reported directly (a memo pasted as a Notion share link read as
// dead text otherwise). Only applies to the read-only <p> below, not the
// editing <textarea>: a textarea can't render an inline anchor, so
// clicking into edit mode always shows the plain underlying text, same
// as any other markdown-ish display/edit split.
function linkify(text: string): ReactNode[] {
  return text.split(URL_PATTERN).map((part, i) =>
    /^https?:\/\//.test(part)
      ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="underline decoration-1 underline-offset-2 hover:opacity-70"
        >
          {part}
        </a>
      )
      : part
  )
}

// One tile on the shared grid (memo-board.tsx) — a fixed 4:5 aspect
// ratio (taller than the square it started as, per direct request),
// reorderable by dragging but never freely positioned (see 095/096 for
// why: a grid, not a corkboard). Text is read-only until clicked, since
// a live <textarea> can't render a clickable link inline the way plain
// text can — swapping to an actual textarea only while editing keeps
// both: clickable links and truncation at rest, full plain-text editing
// on click.
//
// Reordering uses the native HTML5 Drag and Drop API, not this app's
// usual pointer-events free-drag (use-draggable.ts, placed-sticker.tsx)
// — that pattern tracks continuous (x, y) for a single freely-positioned
// element; this is a discrete "which slot did I drop onto" question
// across many siblings, which dragover/drop targets answer directly
// without hand-rolled hit-testing against every other tile's rect.
//
// The drag source is a dedicated grip handle, not the whole tile — same
// reasoning as the free-drag version's own handle: a text-only or
// image-only tile can be 100% textarea/image with no other surface to
// grab, and (unrelated but additive here) `draggable` on an element also
// hijacks that element's own native text/image drag and in-place text
// selection, which the image and textarea both still need to keep
// working normally.
export function MemoCard({
  memo, dragging, justAdded, onOpenImage, onCommitContent, onDelete, onDragStart, onDragEnter, onDragEnd,
}: {
  memo: Memo
  dragging: boolean
  // True only for the one render right after this memo was created this
  // session — see .animate-memo-add in globals.css and the justAddedIds
  // tracking in memo-board.tsx (mirrors placed-sticker.tsx's own
  // justPlaced/animate-sticker-drop for the exact same reason).
  justAdded: boolean
  onOpenImage: () => void
  onCommitContent: (content: string) => void
  onDelete: () => void
  onDragStart: () => void
  onDragEnter: () => void
  onDragEnd: () => void
}) {
  const [content, setContent] = useState(memo.content)
  const [editing, setEditing] = useState(false)

  function stopEditing() {
    setEditing(false)
    if (content !== memo.content) onCommitContent(content)
  }

  return (
    <div
      className={`group relative aspect-[4/5] transition-opacity ${dragging ? 'opacity-40' : ''} ${justAdded ? 'animate-memo-add' : ''}`}
      onDragOver={e => e.preventDefault()}
      onDragEnter={onDragEnter}
      onDrop={e => e.preventDefault()}
    >
      <div className="card noir-panel-bg noir-border overflow-hidden h-full flex flex-col select-none">
        <div
          draggable
          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
          onDragEnd={onDragEnd}
          className="flex items-center justify-center h-5 shrink-0 cursor-grab active:cursor-grabbing"
        >
          <GripHorizontal size={14} className="text-ink-400/50 noir-accent-color" />
        </div>

        {memo.image_url && (
          // stopPropagation on click only — the drag handle above is the
          // only thing draggable={true}, so this needs no drag handling
          // of its own; draggable={false} just stops the image's own
          // default native-drag-out behavior from firing on top of it.
          <div
            onClick={e => { e.stopPropagation(); onOpenImage() }}
            className={`relative w-full shrink-0 cursor-zoom-in ${memo.content || editing ? 'h-3/5' : 'h-full'}`}
          >
            <Image src={memo.image_url} alt="" fill draggable={false} sizes="(min-width: 1020px) 20vw, 45vw" className="object-cover" />
          </div>
        )}

        {(!memo.image_url || memo.content || editing) && (
          <div className="flex-1 min-h-0 p-3">
            {editing ? (
              <textarea
                autoFocus
                value={content}
                onChange={e => setContent(e.target.value)}
                onClick={e => e.stopPropagation()}
                onBlur={stopEditing}
                placeholder="Write a memo…"
                className="w-full h-full resize-none bg-transparent border-0 focus:outline-none text-sm text-ink noir-accent-color noir-placeholder-accent placeholder:text-ink/30"
              />
            ) : (
              // overflow-hidden, not line-clamp-N — line-clamp caps at a
              // fixed line count regardless of the tile's actual height,
              // which on this responsive grid (column width, and so tile
              // height, varies by breakpoint) cut text off early and left
              // real empty space below it, reported directly. Plain
              // overflow-hidden instead fills exactly the box it's given.
              // The bottom-fade mask always applies once there's content —
              // it doesn't check whether this particular memo actually
              // overflows (that would need measuring the rendered text
              // against the box, e.g. a ref + ResizeObserver), so a short
              // memo's own last line reads very slightly dimmed even
              // though nothing is cut off. Cheap trade for not needing
              // that measurement; revisit if the dimming reads as a bug
              // rather than a static hint.
              <p
                onClick={e => { e.stopPropagation(); setEditing(true) }}
                className={`w-full h-full text-sm cursor-text whitespace-pre-wrap overflow-hidden noir-accent-color ${content ? 'text-ink' : 'text-ink/30'}`}
                style={content ? { maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)' } : undefined}
              >
                {content ? linkify(content) : 'Write a memo…'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Hover-revealed, not click-to-select — reported directly. Always
          rendered (not conditionally, the way the old click/selected
          version was) so it can transition in/out smoothly; opacity-0 +
          pointer-events-none keeps it invisible and inert at rest, and
          group-hover's :hover lives on the OUTER wrapper above, so it
          fires from a pointer anywhere over the tile — including over
          the image or text, unlike the old click path, which needed a
          capture-phase workaround specifically because an image-only
          tile's own onClick(stopPropagation) blocked a plain bubble-phase
          click from ever reaching a selection handler. focus-visible
          mirrors the same reveal for keyboard tabbing. */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete() }}
        aria-label="Delete memo"
        className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-ink-900 text-scroll-100 flex items-center justify-center shadow-parchment opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto transition-opacity"
      >
        <X size={12} />
      </button>
    </div>
  )
}
