'use client'
import { useEffect, useRef } from 'react'

// The dropdown in new/edit-session-form.tsx is driven off this list, not
// hardcoded options — adding a future effect (snow, embers, …) means
// adding an entry here plus a case in ParticleEffect's rain-only switch
// below, nothing else.
export const PARTICLE_EFFECTS = [
  { value: 'rain', label: 'Rain' },
] as const

type Drop = { x: number; y: number; length: number; speed: number; opacity: number }

function randomDrop(width: number, height: number, atRandomHeight: boolean): Drop {
  return {
    x: Math.random() * width,
    y: atRandomHeight ? Math.random() * height : -30,
    length: 14 + Math.random() * 22,
    speed: 5 + Math.random() * 7,
    opacity: 0.12 + Math.random() * 0.28,
  }
}

// Layered between the session's fixed background image (z-0) and its log
// card ([slug]/page.tsx gives that card's wrapper an explicit z-10 so it
// always stacks above this regardless of DOM order) — a full-viewport
// canvas, pointer-events-none so it never blocks the log underneath.
// Drop count scales with viewport area rather than a fixed number so it
// reads the same density on a phone as on an ultrawide monitor.
export function ParticleEffect({ effect }: { effect: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (effect !== 'rain') return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let drops: Drop[] = []

    function resize() {
      width = canvas!.width = window.innerWidth
      height = canvas!.height = window.innerHeight
      const count = Math.round((width * height) / 9000)
      drops = Array.from({ length: count }, () => randomDrop(width, height, true))
    }
    resize()
    window.addEventListener('resize', resize)

    function draw() {
      ctx!.clearRect(0, 0, width, height)
      ctx!.strokeStyle = '#ffffff'
      ctx!.lineWidth = 1
      for (const drop of drops) {
        ctx!.globalAlpha = drop.opacity
        ctx!.beginPath()
        ctx!.moveTo(drop.x, drop.y)
        ctx!.lineTo(drop.x, drop.y + drop.length)
        ctx!.stroke()
      }
      ctx!.globalAlpha = 1
    }

    if (reduceMotion) {
      draw()
      return () => window.removeEventListener('resize', resize)
    }

    let frame = requestAnimationFrame(step)
    function step() {
      for (const drop of drops) {
        drop.y += drop.speed
        if (drop.y - drop.length > height) Object.assign(drop, randomDrop(width, height, false))
      }
      draw()
      frame = requestAnimationFrame(step)
    }

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(frame)
    }
  }, [effect])

  if (effect !== 'rain') return null

  return <canvas ref={canvasRef} className="fixed inset-0 z-[1] pointer-events-none" aria-hidden="true" />
}
