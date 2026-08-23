'use client'
import { useEffect, useRef } from 'react'

// Each state's sprite sheet is N 48×48 frames laid out horizontally (see
// the one-off Python extraction that generated public/cursors/*.png from
// the source .gif set). vertical-resize/"help" stayed dropped — still no
// UI maps to them — but diagonal-resize-1 and horizontal-resize were
// each added for a specific placed-sticker.tsx handle (cursor-nwse-resize
// for the resize corner, cursor-alias for the tilt handle), reported
// directly; the hand-drawn frame count/asset list here needs updating by
// hand if another gets wired up later. Frame count matters for wrapping
// the index; duration is a flat 100ms/frame since the source GIFs
// carried no per-frame timing of their own (all read back as 0ms — a
// common encoder default that just means "browser's own guess").
const FRAME_SIZE = 48
const FRAME_MS = 100
// Grace period before actually falling back to the native cursor once a
// mapped state stops matching — reported directly: placed-sticker.tsx's
// own resize/rotate handles (cursor-nwse-resize, cursor-alias) sit right
// at a selected sticker's edges, both unmapped by design (see
// stateForComputedCursor's own comment), so ordinary mouse movement
// around a selected sticker's body kept grazing them and instantly
// flashing to the native arrow and back — many times a second. Switching
// TO a mapped state stays instant; switching AWAY to native only commits
// after this many ms of continuously hovering something unmapped, so a
// quick pass over a ~15px handle never shows the flash, while genuinely
// resting on one still correctly reveals the native cursor after a beat.
const NATIVE_FALLBACK_DELAY_MS = 120
const STATES = {
  default: { src: '/cursors/default.png', frames: 16 },
  pointer: { src: '/cursors/link-and-hover.png', frames: 16 },
  text: { src: '/cursors/text-edit.png', frames: 16 },
  notAllowed: { src: '/cursors/disabled.png', frames: 16 },
  move: { src: '/cursors/move.png', frames: 5 },
  busy: { src: '/cursors/in-use.png', frames: 16 },
  progress: { src: '/cursors/background-work.png', frames: 16 },
  resize: { src: '/cursors/diagonal-resize-1.png', frames: 5 },
  tilt: { src: '/cursors/horizontal-resize.png', frames: 5 },
} as const
type StateKey = keyof typeof STATES

// Maps the CSS `cursor` value already in effect at the hovered element
// (Tailwind's cursor-pointer/cursor-grab/cursor-not-allowed utilities
// used throughout this app, plus the browser's own UA default for text
// inputs/contentEditable) onto one of our custom states — deliberately
// reads what's already declared instead of hand-maintaining a parallel
// selector list, so any future cursor-pointer/cursor-grab/etc. element
// picks up the matching custom cursor for free. Anything not listed here
// (resize handles, `alias`, …) returns null, meaning "no custom cursor
// for this — let the native OS cursor show through" rather than showing
// nothing.
function stateForComputedCursor(computed: string): StateKey | null {
  switch (computed) {
    case 'pointer': return 'pointer'
    case 'text': return 'text'
    case 'not-allowed': return 'notAllowed'
    case 'grab': case 'grabbing': case 'move': return 'move'
    case 'progress': return 'progress'
    case 'nwse-resize': return 'resize'
    case 'alias': return 'tilt'
    case 'default': case 'auto': return 'default'
    default: return null
  }
}

export function CustomCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Fine-pointer devices only — a touch device has no persistent mouse
    // position for this to track, and would otherwise leave a stray
    // sprite stuck at the last tap location.
    if (!window.matchMedia('(pointer: fine)').matches) return

    const canvasEl = canvasRef.current
    const ctxEl = canvasEl?.getContext('2d')
    if (!canvasEl || !ctxEl) return
    // Reassigned to plain consts — TS doesn't carry the narrowing above
    // through the `step` closure below (it's called async, via rAF, so
    // canvas/ctx read as possibly-null again there without this).
    const canvas = canvasEl
    const ctx = ctxEl

    // Set imperatively, not as a width/height prop — the prop would read
    // window.innerWidth during the very first client render (before
    // hydration settles), which the server-rendered 0×0 markup can't
    // match, tripping a hydration mismatch. Same reasoning and pattern as
    // particle-effects.tsx's own resize().
    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const images: Partial<Record<StateKey, HTMLImageElement>> = {}
    for (const key of Object.keys(STATES) as StateKey[]) {
      const img = new Image()
      img.src = STATES[key].src
      images[key] = img
    }

    let x = -1000
    let y = -1000
    let visible = false
    // Computed once per pointermove (event-driven), not once per
    // animation frame — getComputedStyle forces a synchronous style
    // recalc, and calling it ~60×/sec regardless of whether the hovered
    // element had even changed was real, avoidable per-frame cost, likely
    // the actual source of the reported glitching (main-thread
    // contention delaying the canvas draw a frame or two behind the real
    // mouse position, which reads as the native arrow and the sprite
    // both flashing). hoverKey only changes on a real pointermove now;
    // wasClassActive/activeKey below only get touched when their value
    // actually needs to change, not unconditionally every frame either.
    let hoverKey: StateKey | null = null
    let activeKey: StateKey | null = null
    let wasClassActive = false
    let frame = 0
    let lastFrameTime = 0
    let fallbackTimer: number | null = null

    function handleMove(e: PointerEvent) {
      x = e.clientX
      y = e.clientY
      visible = true

      // custom-cursor-active forces `cursor: none !important` on every
      // element (globals.css) — including whatever getComputedStyle
      // reads right below, once the class is already on from a previous
      // move. Without lifting it first, every read past the very first
      // one sees our own override ("none") instead of the element's real
      // declared cursor, which stateForComputedCursor doesn't recognize
      // — hoverKey falls to null, native shows, the class comes off,
      // the NEXT read sees the real value again, the class goes back on,
      // and the cycle repeats every single move. This is what was
      // actually glitching, not (only) the resize-handle case fixed
      // separately above. Removing the class, reading, then restoring it
      // all happen synchronously in one task — no paint occurs between
      // the two DOM writes, so there's nothing to visibly flash.
      const wasActive = document.documentElement.classList.contains('custom-cursor-active')
      if (wasActive) document.documentElement.classList.remove('custom-cursor-active')
      const key = e.target instanceof Element ? stateForComputedCursor(getComputedStyle(e.target).cursor) : 'default'
      if (wasActive) document.documentElement.classList.add('custom-cursor-active')

      if (key !== null) {
        if (fallbackTimer !== null) { window.clearTimeout(fallbackTimer); fallbackTimer = null }
        hoverKey = key
      } else if (hoverKey !== null && fallbackTimer === null) {
        fallbackTimer = window.setTimeout(() => {
          hoverKey = null
          fallbackTimer = null
        }, NATIVE_FALLBACK_DELAY_MS)
      }
    }
    function handleLeave() { visible = false }

    window.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerleave', handleLeave)

    let raf = requestAnimationFrame(step)
    function step(time: number) {
      raf = requestAnimationFrame(step)

      // A page-wide "the whole app is busy" signal (dot-matrix-loader.tsx
      // sets this on mount/unmount) always wins over whatever's under the
      // pointer — matches the Windows "Busy" cursor's own semantics of
      // "nothing is interactive right now," not just the hovered element.
      // Just a dataset read, not a style recalc, so still cheap to check
      // every frame — this is what lets busy state react instantly
      // without needing its own mutation observer.
      const busy = document.body.dataset.cursorBusy === 'true'
      const nextKey = busy ? 'busy' : hoverKey

      if (nextKey !== activeKey) {
        activeKey = nextKey
        frame = 0
        lastFrameTime = time
      }

      const isClassActive = visible && activeKey !== null
      if (isClassActive !== wasClassActive) {
        document.documentElement.classList.toggle('custom-cursor-active', isClassActive)
        wasClassActive = isClassActive
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!visible || !activeKey) return

      const state = STATES[activeKey]
      const img = images[activeKey]
      if (!img?.complete) return

      if (!reduceMotion && time - lastFrameTime >= FRAME_MS) {
        frame = (frame + 1) % state.frames
        lastFrameTime = time
      }

      ctx.drawImage(img, frame * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE, x, y, FRAME_SIZE, FRAME_SIZE)
    }

    return () => {
      window.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerleave', handleLeave)
      window.removeEventListener('resize', resize)
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer)
      cancelAnimationFrame(raf)
      document.documentElement.classList.remove('custom-cursor-active')
    }
  }, [])

  // Sized imperatively in the effect above (see its own comment on why),
  // not via width/height props. Drawn into at absolute coordinates rather
  // than CSS-translated, so a single clearRect+drawImage per frame is all
  // animation needs. pointer-events-none so it never blocks clicks.
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[999] pointer-events-none"
      aria-hidden="true"
    />
  )
}
