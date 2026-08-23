'use client'
import { useEffect, useRef } from 'react'

// The dropdown in new/edit-session-form.tsx is driven off this list, not
// hardcoded options — adding a future effect (snow, embers, …) means
// adding an entry here, a spawn/draw pair below, and one branch in the
// two switches inside ParticleEffect, nothing else.
export const PARTICLE_EFFECTS = [
  { value: 'rain', label: 'Rain' },
  { value: 'stars', label: 'Stars' },
  { value: 'gravity', label: 'Gravity' },
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

// Each particle rests at its own (homeX, homeY), nudged by a slow ambient
// wobble (wobbleSpeed/wobbleOffset, applied only at draw time — never
// touches the physics state) so the at-rest look reads as gently
// floating rather than frozen. Pulled toward the pointer within
// GRAVITY_RADIUS, then eased back to home by a spring once it's out of
// range or the pointer leaves — that "settling back down" is the
// "gravity" in the name. baseOpacity sits well above rain/stars'
// own — reported directly: the reference site's own resting particles
// read as too faint, and this state (no pointer nearby) is what most
// visitors actually see most of the time.
type GravityParticle = {
  x: number; y: number
  homeX: number; homeY: number
  vx: number; vy: number
  radius: number
  baseOpacity: number
  wobbleSpeed: number
  wobbleOffset: number
}

const GRAVITY_RADIUS = 170
const GRAVITY_PULL = 0.045
const GRAVITY_SPRING = 0.02
const GRAVITY_DAMPING = 0.9

function randomGravityParticle(width: number, height: number): GravityParticle {
  const x = Math.random() * width
  const y = Math.random() * height
  return {
    x, y, homeX: x, homeY: y,
    vx: 0, vy: 0,
    radius: 1.5 + Math.random() * 2.5,
    baseOpacity: 0.55 + Math.random() * 0.4,
    wobbleSpeed: 0.3 + Math.random() * 0.5,
    wobbleOffset: Math.random() * Math.PI * 2,
  }
}

// Layered between the session's fixed background image (z-0) and its log
// card ([slug]/page.tsx gives that card's wrapper an explicit z-10 so it
// always stacks above this regardless of DOM order) — a full-viewport
// canvas, pointer-events-none so it never blocks the log underneath (the
// canvas itself never receives pointer events — gravity's own pointer
// tracking listens on window instead, same technique as
// custom-cursor.tsx). Particle counts scale with viewport area rather
// than a fixed number so density reads the same on a phone as on an
// ultrawide monitor.
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
    let gravityParticles: GravityParticle[] = []

    function resize() {
      width = canvas!.width = window.innerWidth
      height = canvas!.height = window.innerHeight
      if (effect === 'rain') {
        drops = Array.from({ length: Math.round((width * height) / 9000) }, () => randomDrop(width, height, true))
      } else if (effect === 'stars') {
        stars = Array.from({ length: Math.round((width * height) / 6000) }, () => randomStar(width, height))
      } else {
        gravityParticles = Array.from({ length: Math.round((width * height) / 8000) }, () => randomGravityParticle(width, height))
      }
    }
    resize()
    window.addEventListener('resize', resize)

    let pointerX = -9999
    let pointerY = -9999
    let pointerActive = false
    function handlePointerMove(e: PointerEvent) {
      pointerX = e.clientX
      pointerY = e.clientY
      pointerActive = true
    }
    function handlePointerLeave() { pointerActive = false }
    if (effect === 'gravity') {
      window.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerleave', handlePointerLeave)
    }

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

    function drawGravity(time: number) {
      for (const p of gravityParticles) {
        const wobble = Math.sin(time * 0.001 * p.wobbleSpeed + p.wobbleOffset) * 2
        const drawX = p.x + wobble
        const drawY = p.y

        // Brighter and slightly larger the closer it is to the pointer's
        // pull radius — a visual cue that it's actively being drawn in,
        // not just a static opacity bump.
        const dist = Math.hypot(pointerX - p.x, pointerY - p.y)
        const proximity = pointerActive && dist < GRAVITY_RADIUS ? 1 - dist / GRAVITY_RADIUS : 0
        const opacity = Math.min(1, p.baseOpacity + proximity * 0.45)
        const radius = p.radius * (1 + proximity * 0.6)

        const gradient = ctx!.createRadialGradient(drawX, drawY, 0, drawX, drawY, radius * 3)
        gradient.addColorStop(0, `rgba(255,255,255,${opacity})`)
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        ctx!.fillStyle = gradient
        ctx!.beginPath()
        ctx!.arc(drawX, drawY, radius * 3, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    function draw(time: number) {
      ctx!.clearRect(0, 0, width, height)
      if (effect === 'rain') drawRain()
      else if (effect === 'stars') drawStars(time)
      else drawGravity(time)
    }

    if (reduceMotion) {
      draw(0)
      return () => {
        window.removeEventListener('resize', resize)
        window.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerleave', handlePointerLeave)
      }
    }

    let frame = requestAnimationFrame(step)
    function step(time: number) {
      if (effect === 'rain') {
        for (const drop of drops) {
          drop.y += drop.speed
          if (drop.y - drop.length > height) Object.assign(drop, randomDrop(width, height, false))
        }
      } else if (effect === 'gravity') {
        for (const p of gravityParticles) {
          const dx = pointerX - p.x
          const dy = pointerY - p.y
          const dist = Math.hypot(dx, dy)
          if (pointerActive && dist < GRAVITY_RADIUS && dist > 0.01) {
            const force = (1 - dist / GRAVITY_RADIUS) * GRAVITY_PULL
            p.vx += (dx / dist) * force
            p.vy += (dy / dist) * force
          } else {
            p.vx += (p.homeX - p.x) * GRAVITY_SPRING
            p.vy += (p.homeY - p.y) * GRAVITY_SPRING
          }
          p.vx *= GRAVITY_DAMPING
          p.vy *= GRAVITY_DAMPING
          p.x += p.vx
          p.y += p.vy
        }
      }
      draw(time)
      frame = requestAnimationFrame(step)
    }

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerleave', handlePointerLeave)
      cancelAnimationFrame(frame)
    }
  }, [effect])

  if (!isEffectValue(effect)) return null

  return <canvas ref={canvasRef} className="fixed inset-0 z-[1] pointer-events-none" aria-hidden="true" />
}
