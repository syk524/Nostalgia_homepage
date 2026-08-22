'use client'
import { useEffect, useRef } from 'react'

// The dropdown in new/edit-session-form.tsx is driven off this list, not
// hardcoded options — adding a future effect (snow, embers, …) means
// adding an entry here, a spawn/draw pair below, and one branch in the
// two switches inside ParticleEffect, nothing else.
export const PARTICLE_EFFECTS = [
  { value: 'rain', label: 'Rain' },
  { value: 'stars', label: 'Stars' },
] as const

type EffectValue = typeof PARTICLE_EFFECTS[number]['value']

function isEffectValue(value: string | null): value is EffectValue {
  return PARTICLE_EFFECTS.some(e => e.value === value)
}

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

// Just the dots, no dark-sky fill behind them — reported directly, since
// this needs to sit over whatever background the session already has
// (image, blur, or none) rather than imposing one of its own the way the
// reference site's own gradient did.
type Star = { x: number; y: number; radius: number; baseOpacity: number; twinkleSpeed: number; twinkleOffset: number }

function randomStar(width: number, height: number): Star {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 0.6 + Math.random() * 1.4,
    baseOpacity: 0.35 + Math.random() * 0.55,
    twinkleSpeed: 0.6 + Math.random() * 1.4,
    twinkleOffset: Math.random() * Math.PI * 2,
  }
}

// Layered between the session's fixed background image (z-0) and its log
// card ([slug]/page.tsx gives that card's wrapper an explicit z-10 so it
// always stacks above this regardless of DOM order) — a full-viewport
// canvas, pointer-events-none so it never blocks the log underneath.
// Particle counts scale with viewport area rather than a fixed number so
// density reads the same on a phone as on an ultrawide monitor.
export function ParticleEffect({ effect }: { effect: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!isEffectValue(effect)) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let drops: Drop[] = []
    let stars: Star[] = []

    function resize() {
      width = canvas!.width = window.innerWidth
      height = canvas!.height = window.innerHeight
      if (effect === 'rain') {
        drops = Array.from({ length: Math.round((width * height) / 9000) }, () => randomDrop(width, height, true))
      } else {
        stars = Array.from({ length: Math.round((width * height) / 6000) }, () => randomStar(width, height))
      }
    }
    resize()
    window.addEventListener('resize', resize)

    function drawRain() {
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

    function drawStars(time: number) {
      ctx!.fillStyle = '#ffffff'
      for (const star of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(time * 0.0012 * star.twinkleSpeed + star.twinkleOffset)
        ctx!.globalAlpha = star.baseOpacity * twinkle
        ctx!.beginPath()
        ctx!.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
    }

    function draw(time: number) {
      ctx!.clearRect(0, 0, width, height)
      if (effect === 'rain') drawRain()
      else drawStars(time)
    }

    if (reduceMotion) {
      draw(0)
      return () => window.removeEventListener('resize', resize)
    }

    let frame = requestAnimationFrame(step)
    function step(time: number) {
      if (effect === 'rain') {
        for (const drop of drops) {
          drop.y += drop.speed
          if (drop.y - drop.length > height) Object.assign(drop, randomDrop(width, height, false))
        }
      }
      draw(time)
      frame = requestAnimationFrame(step)
    }

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(frame)
    }
  }, [effect])

  if (!isEffectValue(effect)) return null

  return <canvas ref={canvasRef} className="fixed inset-0 z-[1] pointer-events-none" aria-hidden="true" />
}
