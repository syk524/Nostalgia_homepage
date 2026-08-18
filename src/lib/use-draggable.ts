'use client'
import { useCallback, useRef, useState } from 'react'

export type DragOffset = { x: number; y: number }

// Pointer-based free-drag: Pointer Events unify mouse, touch, and pen, so
// this works the same across all three with no separate touch handling.
// stopPropagation on pointerdown means a nested draggable element always
// opts out of a draggable ancestor's own gesture — see
// draggable-home-scene.tsx, where dragging the wordmark/sticker directly
// must not also pan the canvas underneath. No position is persisted
// anywhere; it's plain component state, gone on reload.
export function useDraggable() {
  const [offset, setOffset] = useState<DragOffset>({ x: 0, y: 0 })
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
    drag.current = null
    setDragging(false)
  }, [])

  return {
    offset,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag },
  }
}
