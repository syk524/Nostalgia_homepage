'use client'
import { useRef, useState } from 'react'
import { MemoCard } from '@/components/memo-card'
import { NewMemoTile } from '@/components/new-memo-tile'
import { ImageLightbox } from '@/components/image-lightbox'
import { updateMemoContent, deleteMemo, reorderMemos } from '@/lib/actions/memo'
import type { Memo } from '@/types/database'

export function MemoBoard({ initialMemos, userId }: { initialMemos: Memo[]; userId: string }) {
  const [memos, setMemos] = useState(initialMemos)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // Tracks only memos created THIS session, not the initial server-fetched
  // ones — an id lands here once, on creation, and is removed after the
  // entrance animation's own duration (see globals.css's .animate-memo-add,
  // 180ms; 220 leaves a small buffer). Without this, applying the
  // animation unconditionally to every MemoCard would replay it for
  // every existing memo on every page load, not just for one actually
  // being added — same reasoning/shape as draggable-home-scene.tsx's own
  // justPlacedIds for stickers.
  const [justAddedIds, setJustAddedIds] = useState<Set<string>>(new Set())

  function handleCreated(memo: Memo) {
    setMemos(prev => [memo, ...prev])
    setJustAddedIds(prev => new Set(prev).add(memo.id))
    setTimeout(() => {
      setJustAddedIds(prev => {
        const next = new Set(prev)
        next.delete(memo.id)
        return next
      })
    }, 220)
  }

  // Which memo the drag started on — read from a ref, not state, inside
  // handleDragEnter: state set by the same onDragStart that fires just
  // before the browser starts sending dragenter events wouldn't
  // necessarily have committed yet by the time the very first dragenter
  // lands, since React batches the state update async while the browser
  // fires these as native (not React-scheduled) events.
  const draggingId = useRef<string | null>(null)
  const [draggingIdForRender, setDraggingIdForRender] = useState<string | null>(null)

  function startDrag(id: string) {
    draggingId.current = id
    setDraggingIdForRender(id)
  }

  function dragEnter(overId: string) {
    const fromId = draggingId.current
    if (!fromId || fromId === overId) return
    setMemos(prev => {
      const from = prev.findIndex(m => m.id === fromId)
      const to = prev.findIndex(m => m.id === overId)
      if (from === -1 || to === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  // Reads `memos` straight from the closure rather than a setMemos(current
  // => ...) trick — this handler is recreated every render (a plain
  // function in the component body, not memoized), so the one actually
  // bound to onDragEnd by the time dragend fires always closes over the
  // latest state, already reflecting every live dragEnter shuffle. Firing
  // a server-action side effect from inside a state updater instead would
  // run it twice under Strict Mode's double-invoke.
  function endDrag() {
    draggingId.current = null
    setDraggingIdForRender(null)
    reorderMemos(memos.map(m => m.id))
  }

  function commitContent(id: string, content: string) {
    setMemos(prev => prev.map(m => (m.id === id ? { ...m, content } : m)))
    updateMemoContent(id, content)
  }

  async function handleDelete(id: string) {
    const memo = memos.find(m => m.id === id)
    setMemos(prev => prev.filter(m => m.id !== id))
    if (memo) await deleteMemo(id, memo.storage_path)
  }

  return (
    <div className="relative min-h-[70vh] w-full">
      <div className="grid grid-cols-2 min-[640px]:grid-cols-3 min-[1020px]:grid-cols-4 min-[1400px]:grid-cols-5 gap-4">
        <NewMemoTile userId={userId} onCreated={handleCreated} />
        {memos.map(memo => (
          <MemoCard
            key={memo.id}
            memo={memo}
            dragging={draggingIdForRender === memo.id}
            justAdded={justAddedIds.has(memo.id)}
            onOpenImage={() => memo.image_url && setLightboxSrc(memo.image_url)}
            onCommitContent={content => commitContent(memo.id, content)}
            onDelete={() => handleDelete(memo.id)}
            onDragStart={() => startDrag(memo.id)}
            onDragEnter={() => dragEnter(memo.id)}
            onDragEnd={endDrag}
          />
        ))}
      </div>

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  )
}
