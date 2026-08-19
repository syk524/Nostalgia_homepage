'use client'
import { useCallback, useRef, useState } from 'react'
import { X, RotateCw } from 'lucide-react'
import type { UserBackgroundSticker } from '@/types/database'

const SIZE = 100
const MIN_SCALE = 0.4
const MAX_SCALE = 3

// One image dropped from the sticker gallery onto the home page
// background. Mirrors the free-drag mechanics of useDraggable (see
// stickers.tsx) for moving the whole sticker, but adds two more
// gestures that only appear once selected: a corner handle for
// resize (distance from center vs. the drag start distance) and a
// top handle for tilt (angle from center). All three gestures commit
// via onCommit only when the pointer is released, matching
// usePersistentDraggable's save-on-end pattern — dragging itself
// stays purely local state, no network chatter per pixel moved.
export function PlacedSticker({ sticker, panX, panY, selected, justPlaced, onSelect, onRemove, onCommit }: {
  sticker: UserBackgroundSticker
  panX: number
  panY: number
  selected: boolean
  // True only for the one render right after this sticker was dropped
  // this session — see .animate-sticker-drop in globals.css and the
  // justPlacedIds tracking in draggable-home-scene.tsx.
  justPlaced?: boolean
  onSelect: () => void
  onRemove: () => void
  onCommit: (patch: { x: number; y: number; scale: number; rotation: number }) => void
}) {
  const [x, setX] = useState(sticker.pos_x)
  const [y, setY] = useState(sticker.pos_y)
  const [scale, setScale] = useState(sticker.scale)
  const [rotation, setRotation] = useState(sticker.rotation)
  const [mode, setMode] = useState<'idle' | 'move' | 'resize' | 'rotate'>('idle')

  const gesture = useRef<{
    startClientX: number; startClientY: number
    originX: number; originY: number; originScale: number; originRotation: number
    centerX: number; centerY: number
  } | null>(null)
  const elRef = useRef<HTMLDivElement>(null)

  const beginMove = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    onSelect()
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current = { startClientX: e.clientX, startClientY: e.clientY, originX: x, originY: y, originScale: scale, originRotation: rotation, centerX: 0, centerY: 0 }
    setMode('move')
  }, [x, y, scale, rotation, onSelect])

  const beginHandle = useCallback((kind: 'resize' | 'rotate') => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = elRef.current?.getBoundingClientRect()
    const centerX = rect ? rect.left + rect.width / 2 : e.clientX
    const centerY = rect ? rect.top + rect.height / 2 : e.clientY
    gesture.current = { startClientX: e.clientX, startClientY: e.clientY, originX: x, originY: y, originScale: scale, originRotation: rotation, centerX, centerY }
    setMode(kind)
  }, [x, y, scale, rotation])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return

    if (mode === 'move') {
      setX(g.originX + (e.clientX - g.startClientX))
      setY(g.originY + (e.clientY - g.startClientY))
    } else if (mode === 'resize') {
      const startDist = Math.hypot(g.startClientX - g.centerX, g.startClientY - g.centerY)
      const dist = Math.hypot(e.clientX - g.centerX, e.clientY - g.centerY)
      const next = g.originScale * (dist / Math.max(startDist, 1))
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)))
    } else if (mode === 'rotate') {
      const startAngle = Math.atan2(g.startClientY - g.centerY, g.startClientX - g.centerX)
      const angle = Math.atan2(e.clientY - g.centerY, e.clientX - g.centerX)
      const deltaDeg = (angle - startAngle) * (180 / Math.PI)
      setRotation(g.originRotation + deltaDeg)
    }
  }, [mode])

  const endGesture = useCallback(() => {
    if (!gesture.current) return
    gesture.current = null
    setMode('idle')
    onCommit({ x, y, scale, rotation })
    // Reading x/y/scale/rotation directly off the closure (all four in
    // the dependency array) rather than the setX(current => { onCommit(...);
    // return current }) trick this used to do — that called onCommit,
    // which calls the parent's setPlacements, from inside a setX updater,
    // which React runs as part of processing this component's own state
    // update. Updating a different component from inside that is exactly
    // what "Cannot update a component while rendering a different
    // component" is about, and it could abort before the commit actually
    // went through — dragging/resizing would feel fine but silently fail
    // to save.
  }, [x, y, scale, rotation, onCommit])

  return (
    <div
      ref={elRef}
      className="absolute left-0 top-0 touch-none"
      style={{
        transform: `translate(${panX + x}px, ${panY + y}px) translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
        zIndex: selected ? 30 : 10 + sticker.z,
      }}
    >
      <img
        src={sticker.gallery?.image_url}
        alt=""
        onPointerDown={beginMove}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        draggable={false}
        className={`block select-none pointer-events-auto ${mode === 'move' ? 'cursor-grabbing' : 'cursor-grab'} ${justPlaced ? 'animate-sticker-drop' : ''}`}
        style={{ width: SIZE, height: SIZE, objectFit: 'contain' }}
      />

      {selected && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 border border-dashed border-ink-500/50 rounded" />

          <button
            type="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={onRemove}
            aria-label="Remove sticker"
            style={{ transform: `scale(${1 / scale})` }}
            className="pointer-events-auto absolute -top-3 -right-3 w-6 h-6 rounded-full bg-ink-900 text-scroll-100 flex items-center justify-center shadow-parchment"
          >
            <X size={12} />
          </button>

          <div
            onPointerDown={beginHandle('rotate')}
            onPointerMove={onPointerMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            aria-label="Tilt sticker"
            style={{ transform: `translateX(-50%) scale(${1 / scale})` }}
            className="pointer-events-auto absolute -top-7 left-1/2 w-5 h-5 rounded-full bg-scroll-50 border border-ink-500/50 flex items-center justify-center cursor-alias touch-none"
          >
            <RotateCw size={10} className="text-ink-500" />
          </div>

          <div
            onPointerDown={beginHandle('resize')}
            onPointerMove={onPointerMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            aria-label="Resize sticker"
            style={{ transform: `scale(${1 / scale})` }}
            className="pointer-events-auto absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-scroll-50 border border-ink-500/50 cursor-nwse-resize touch-none"
          />
        </div>
      )}
    </div>
  )
}
