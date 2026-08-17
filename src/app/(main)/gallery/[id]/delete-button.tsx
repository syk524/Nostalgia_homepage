'use client'
import { useRef, useState } from 'react'

const HOLD_MS = 1200
const RELEASE_MS = 350

// Press-and-hold instead of a click-then-confirm dance — a sweeping fill
// (plain CSS clip-path transition, no animation library) has to complete
// before the delete actually fires, and letting go early just drains it
// back out with nothing deleted.
export function DeletePostButton({ postId }: { postId: string }) {
  const [holding, setHolding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = holding || deleting

  function startHold() {
    if (deleting) return
    setError('')
    setHolding(true)
    timerRef.current = setTimeout(handleDelete, HOLD_MS)
  }

  function cancelHold() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setHolding(false)
  }

  async function handleDelete() {
    timerRef.current = null
    setDeleting(true)
    // A plain fetch to an API route, not the deletePost Server Action — see
    // src/app/api/posts/[id]/route.ts for why.
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
    const result = await res.json().catch(() => null)
    if (!res.ok) { setError(result?.error ?? 'Could not delete this post.'); setDeleting(false); setHolding(false); return }
    // A full page load, not the client router — a soft navigation out of
    // the modal here can land on a 404 for the post we just deleted.
    window.location.href = '/gallery'
  }

  return (
    <div>
      <button
        type="button"
        disabled={deleting}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold() } }}
        onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') cancelHold() }}
        onContextMenu={e => e.preventDefault()}
        aria-label="Hold to delete this post"
        className="relative isolate overflow-hidden select-none touch-none rounded border border-ember/30 hover:border-ember/50 px-4 py-2 text-sm font-medium text-ember transition-colors disabled:cursor-not-allowed"
      >
        <span
          aria-hidden
          className="absolute inset-0 bg-ember"
          style={{
            clipPath: `inset(0 ${active ? 0 : 100}% 0 0)`,
            transitionProperty: 'clip-path',
            transitionDuration: `${active ? HOLD_MS : RELEASE_MS}ms`,
            transitionTimingFunction: active ? 'linear' : 'cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        />
        {/* Two labels stacked in the same cell, crossfaded — avoids the
            ember fill sweeping under illegible same-color text. */}
        <span className="relative z-10 grid">
          <span className={`col-start-1 row-start-1 transition-opacity duration-150 ${active ? 'opacity-0' : 'opacity-100'}`}>
            Hold to delete
          </span>
          <span className={`col-start-1 row-start-1 text-white transition-opacity duration-150 ${active ? 'opacity-100' : 'opacity-0'}`}>
            {deleting ? 'Deleting…' : 'Keep holding…'}
          </span>
        </span>
      </button>
      {error && <p className="field-error text-xs mt-1.5">{error}</p>}
    </div>
  )
}
