'use client'
import { useEffect, useRef } from 'react'

// A calmer, ambient alternative to noir-particle-field.tsx (the home
// page's ripple + cursor-repulsion field) — small motes drifting
// upward at their own pace and gently swaying side to side, looping
// back in at the bottom once they drift past the top. No ripple wave,
// no pointer interaction of any kind: purely passive background
// texture for a scrollable list page, not an interactive centerpiece
// the way the home page's own field is.
export function NoirFloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // One particle per ~9000px² — sparse drifting motes, not the ripple
    // field's own dense per-cell grid.
    const DENSITY_AREA = 9000
    let width = 0, height = 0
    let raf = 0
    let lastFrame = 0

    type Particle = {
      x: number; y: number; baseX: number
      size: number; speed: number
      swayAmp: number; swayFreq: number; swayPhase: number
      twinklePhase: number; twinkleRate: number
      baseAlpha: number
    }
    let particles: Particle[] = []

    function spawn(y?: number): Particle {
      const baseX = Math.random() * width
      return {
        x: baseX, baseX,
        y: y ?? Math.random() * height,
        size: 0.6 + Math.random() * 1.4,
        // Slow, varied drift — a full traverse of the viewport takes
        // roughly 20-45s depending on the particle, not a uniform speed.
        speed: (height / (20000 + Math.random() * 25000)),
        swayAmp: 6 + Math.random() * 14,
        swayFreq: 0.0002 + Math.random() * 0.0004,
        swayPhase: Math.random() * Math.PI * 2,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleRate: 0.0006 + Math.random() * 0.0008,
        baseAlpha: 0.25 + Math.random() * 0.45,
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas!.clientWidth
      height = canvas!.clientHeight
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.max(24, Math.round((width * height) / DENSITY_AREA))
      particles = Array.from({ length: count }, () => spawn())
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, width, height)
      ctx!.fillStyle = '#f1f1f1'

      for (const p of particles) {
        if (!reduceMotion) {
          p.y -= p.speed * 16.7
          // Wrap back in at the bottom, just past the edge, once a
          // particle drifts fully off the top.
          if (p.y < -10) {
            Object.assign(p, spawn(height + 10))
          }
          p.x = p.baseX + Math.sin(t * p.swayFreq + p.swayPhase) * p.swayAmp
        }

        const twinkle = reduceMotion ? 0.7 : (Math.sin(t * p.twinkleRate + p.twinklePhase) + 1) / 2
        ctx!.globalAlpha = p.baseAlpha * (0.5 + twinkle * 0.5)
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    function loop(t: number) {
      // ~24fps, matching noir-particle-field.tsx's own pacing — smooth
      // enough for a slow drift without needing 60fps.
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
    if (!reduceMotion) raf = requestAnimationFrame(loop)

    return () => {
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}
