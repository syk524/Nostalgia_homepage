'use client'
import { useEffect, useRef } from 'react'

// The Noir theme's particle backdrop — a field of individual particles
// (canvas) whose brightness follows a ripple traveling up from the
// bottom of the page, and which physically scatter away from the
// cursor. Extracted out of noir-background.tsx (the home page's own
// Noir decoration, which layers its scattered "NUSTALGIO" wordmark on
// top of this) so any other Noir surface wanting the same ripple +
// repulsion field could reuse it without that home-page-only wordmark
// coming along too. Currently only noir-background.tsx does — the
// Noir list views (pair grid, archive list, gallery grid) use the
// calmer noir-floating-particles.tsx instead, reported directly (no
// ripple, no cursor interaction). Returns bare content (no wrapper
// div) so each caller supplies its own aria-hidden/pointer-events-none/
// positioning wrapper sized to whatever it's meant to sit behind.
export function NoirParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const CELL = 16
    // Three rings in flight at once, evenly staggered through one
    // period, so a new one starts as soon as another fades out —
    // reads as continuous ripples rather than one pulse repeating.
    const RIPPLE_COUNT = 3
    const RIPPLE_PERIOD = 11000
    const BAND_WIDTH = 90
    // Repulsion tuning — how far a particle reacts to the cursor, how
    // far it gets pushed at the very center of that radius, and how
    // quickly it eases toward wherever it's currently being pulled
    // (its resting grid cell, or the pushed-away point), each frame.
    const REPEL_RADIUS = 110
    const REPEL_STRENGTH = 46
    const EASE = 0.14
    let width = 0, height = 0
    let maxRadius = 0
    let raf = 0
    let lastFrame = 0
    // -9999 reads as "offscreen" for distance purposes, so particles
    // sit at rest until the pointer actually enters the page.
    let mouseX = -9999, mouseY = -9999

    // Each particle keeps its own current (x, y) — separate from its
    // resting grid cell (hx, hy) — so it can be eased away from the
    // cursor and back without disturbing the ripple math below, which
    // always reasons about the resting position, not the pushed one.
    type Particle = { hx: number; hy: number; x: number; y: number; seed: number }
    let particles: Particle[] = []

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas!.clientWidth
      height = canvas!.clientHeight
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      maxRadius = Math.hypot(width, height) * 0.7

      const cols = Math.ceil(width / CELL)
      const rows = Math.ceil(height / CELL)
      particles = []
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const hx = col * CELL + CELL / 2
          const hy = row * CELL + CELL / 2
          particles.push({ hx, hy, x: hx, y: hy, seed: ((col * 928371 + row * 12931) % 1000) / 1000 })
        }
      }
    }

    function handlePointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouseX = e.clientX - rect.left
      mouseY = e.clientY - rect.top
    }
    function handleBlur() {
      mouseX = -9999
      mouseY = -9999
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, width, height)
      const fx = width / 2
      const fy = height
      ctx!.fillStyle = '#f1f1f1'

      for (const p of particles) {
        const dist = Math.hypot(p.hx - fx, p.hy - fy)

        // Faint ambient twinkle as a floor, so the field isn't
        // completely bare between ripple passes.
        const flicker = reduceMotion ? 0.5 : (Math.sin(t * 0.0005 + p.seed * Math.PI * 2) + 1) / 2
        let density = 0.06 + flicker * 0.05

        if (!reduceMotion) {
          for (let i = 0; i < RIPPLE_COUNT; i++) {
            const phase = ((t + (i * RIPPLE_PERIOD) / RIPPLE_COUNT) % RIPPLE_PERIOD) / RIPPLE_PERIOD
            const front = phase * maxRadius
            const distFromFront = Math.abs(dist - front)
            const band = Math.max(0, 1 - distFromFront / BAND_WIDTH)
            const rippleDensity = band * (1 - phase)
            density = Math.max(density, rippleDensity)
          }

          // Scatter away from the cursor, radially, harder the closer
          // it is — then ease back toward its resting cell once the
          // cursor moves on.
          const mdx = p.hx - mouseX
          const mdy = p.hy - mouseY
          const mDist = Math.hypot(mdx, mdy)
          let targetX = p.hx, targetY = p.hy
          if (mDist < REPEL_RADIUS && mDist > 0.01) {
            const push = (1 - mDist / REPEL_RADIUS) * REPEL_STRENGTH
            targetX = p.hx + (mdx / mDist) * push
            targetY = p.hy + (mdy / mDist) * push
          }
          p.x += (targetX - p.x) * EASE
          p.y += (targetY - p.y) * EASE
        }

        if (density < 0.05) continue
        // Fixed tiny size — density only drives opacity, not a
        // halftone-style size ramp, so this reads as fine particle
        // grain rather than dots of varying weight.
        ctx!.globalAlpha = Math.min(0.85, density)
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, 1, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    function loop(t: number) {
      // ~24fps — smooth enough for a traveling ripple and cursor
      // repulsion without needing 60fps, and this runs for as long as
      // the Noir theme is active.
      if (t - lastFrame > 42) {
        draw(t)
        lastFrame = t
      }
      raf = requestAnimationFrame(loop)
    }

    resize()
    draw(0)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    if (!reduceMotion) {
      // The canvas itself is pointer-events-none (purely decorative —
      // see every caller's own wrapper), so listening on window is what
      // actually catches pointer moves — they'd never reach an element
      // that can't be hit-tested.
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('blur', handleBlur)
      raf = requestAnimationFrame(loop)
    }

    return () => {
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return (
    <>
      {/* A soft, static glow marking the ripple's origin at the bottom
          of the page — the ripple itself (canvas below) does the animating. */}
      <div
        className="absolute left-1/2 bottom-0 rounded-full bg-white/70"
        style={{ width: '14vmin', height: '14vmin', transform: 'translate(-50%, 50%)', filter: 'blur(28px)' }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </>
  )
}
