'use client'
import { useCallback, useRef, useState } from 'react'
import type { DragOffset } from './use-draggable'

function readStored(key: string, fallback: DragOffset): DragOffset {
  // Guarded for SSR, though in practice this only ever runs client-side —
  // dock windows don't exist until a visitor opens one, so this hook never
  // executes during the server render pass, no hydration mismatch to worry
  // about.
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed
  } catch {
    // Corrupt/foreign value under this key — fall back rather than throw.
  }
  return fallback
}

// Same free-drag mechanics as useDraggable, but the offset starts from
// (and saves back to) localStorage under `storageKey` — used for the
// dock's app windows, where a visitor's chosen position should survive
// closing and reopening the window. This is per-browser, not per account
// (see the resource-cost tradeoff discussed when this was scoped): no new
// table, no server round-trip, just one small localStorage write per drag.
// Saved on pointer-up only, not on every move, so dragging doesn't hammer
// localStorage.
export function usePersistentDraggable(storageKey: string, defaultOffset: DragOffset = { x: 0, y: 0 }) {
  const [offset, setOffset] = useState<DragOffset>(() => readStored(storageKey, defaultOffset))
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y }
    setDragging(true)
  }, [offset])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    setOffset({ x: drag.current.originX + (e.clientX - drag.current.startX), y: drag.current.originY + (e.clientY - drag.current.startY) })
  }, [])

  const endDrag = useCallback(() => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    setOffset(current => {
      try { localStorage.setItem(storageKey, JSON.stringify(current)) } catch {
        // Storage full/unavailable (private browsing, quota) — the drag
        // itself still worked, just won't be remembered next time.
      }
      return current
    })
  }, [storageKey])

  return {
    offset,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag },
  }
}
