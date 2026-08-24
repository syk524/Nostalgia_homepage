'use client'
import { useEffect, useRef } from 'react'

// The dropdown in new/edit-session-form.tsx is driven off this list, not
// hardcoded options — adding a future effect (snow, embers, …) means
// adding an entry here, a spawn/draw pair below, and one branch in the
// two switches inside ParticleEffect, nothing else.
export const PARTICLE_EFFECTS = [
  { value: 'rain', label: 'Rain' },
  { value: 'stars', label: 'Stars' },
  { value: 'vapor', label: 'Vapor' },
] as const

type EffectValue = typeof PARTICLE_EFFECTS[number]['value']

function isEffectValue(value: string | null): value is EffectValue {
  return PARTICLE_EFFECTS.some(e => e.value === value)
}

// What each effect renders as when an editor hasn't picked their own
// color — exported so the create/edit forms can pre-fill their color
// picker with this instead of guessing when someone first turns
// customization on.
export const DEFAULT_PARTICLE_COLORS: Record<EffectValue, string> = {
  rain: '#ffffff',
  stars: '#ffffff',
  vapor: '#08080a',
}

// Canvas fillStyle/strokeStyle both accept a plain hex string directly,
// but the vapor gradient needs its own alpha per stop (rgba(), not hex),
// so this is only ever called from drawVapor. Falls back to the built-in
// vapor default's own components on a malformed hex rather than throwing —
// this only ever receives either that default or something the color
// picker's own regex already validated, but a bad value here should
// never crash the whole effect.
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return [8, 8, 10]
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
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

// A continuous drifting fog bank, not individual specks like rain/stars
// and not the separated soft circles an earlier version of this drew —
// each puff is still a radial gradient (transparent at the edge, same
// technique as before), but two overlapping layers at different sizes/
// speeds/opacities, dense enough that neighboring puffs blend into a
// seamless cloud instead of reading as discrete blobs, are what actually
// gets a continuous vapor look. "Far" is the bigger, slower, fainter
// layer underneath; "near" is smaller, a little faster, and a little
// stronger, layered on top for some depth/texture variation rather than
// one perfectly flat haze. Both drift slowly sideways with a gentle
// vertical bob and wrap back in on the opposite edge once fully
// off-screen — no cursor interaction, reported directly.
type Puff = { x: number; y: number; radius: number; vx: number; vy: number; opacity: number; bobPhase: number; bobAmp: number }

function randomPuff(width: number, height: number, layer: 'far' | 'near'): Puff {
  const isFar = layer === 'far'
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    radius: isFar ? 160 + Math.random() * 140 : 90 + Math.random() * 110,
    vx: (isFar ? 0.03 + Math.random() * 0.07 : 0.07 + Math.random() * 0.13) * (Math.random() < 0.5 ? -1 : 1),
    vy: (Math.random() - 0.5) * 0.03,
    opacity: isFar ? 0.045 + Math.random() * 0.04 : 0.07 + Math.random() * 0.07,
    bobPhase: Math.random() * Math.PI * 2,
    bobAmp: 8 + Math.random() * 14,
  }
}

// Layered between the session's fixed background image (z-0) and its log
// card ([slug]/page.tsx gives that card's wrapper an explicit z-10 so it
// always stacks above this regardless of DOM order) — a full-viewport
// canvas, pointer-events-none so it never blocks the log underneath.
// Particle counts scale with viewport area rather than a fixed number so
// density reads the same on a phone as on an ultrawide monitor.
export function ParticleEffect({ effect, color }: { effect: string | null; color?: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!isEffectValue(effect)) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const resolvedColor = color || DEFAULT_PARTICLE_COLORS[effect]
    const [vaporR, vaporG, vaporB] = hexToRgb(resolvedColor)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let drops: Drop[] = []
    let stars: Star[] = []
    let farPuffs: Puff[] = []
    let nearPuffs: Puff[] = []

    function resize() {
      width = canvas!.width = window.innerWidth
      height = canvas!.height = window.innerHeight
      if (effect === 'rain') {
        drops = Array.from({ length: Math.round((width * height) / 9000) }, () => randomDrop(width, height, true))
      } else if (effect === 'vapor') {
        // Dense enough on both layers that neighboring puffs overlap —
        // see the Puff type's own comment for why that's what actually
        // reads as continuous fog instead of separated blobs.
        const area = width * height
        farPuffs = Array.from({ length: Math.max(10, Math.round(area / 55000)) }, () => randomPuff(width, height, 'far'))
        nearPuffs = Array.from({ length: Math.max(14, Math.round(area / 32000)) }, () => randomPuff(width, height, 'near'))
      } else {
        stars = Array.from({ length: Math.round((width * height) / 6000) }, () => randomStar(width, height))
      }
    }
    resize()
    window.addEventListener('resize', resize)

    function drawRain() {
      ctx!.strokeStyle = resolvedColor
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
      ctx!.fillStyle = resolvedColor
      for (const star of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(time * 0.0012 * star.twinkleSpeed + star.twinkleOffset)
        ctx!.globalAlpha = star.baseOpacity * twinkle
        ctx!.beginPath()
        ctx!.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
    }

    function drawPuffs(puffs: Puff[]) {
      for (const puff of puffs) {
        const gradient = ctx!.createRadialGradient(puff.x, puff.y, 0, puff.x, puff.y, puff.radius)
        // A solid-color core fading to fully transparent at the edge —
        // the gradient itself is what makes this soft rather than the
        // flat, hard-edged fill every other effect here uses. Each
        // puff's own opacity is low enough on its own that it's the
        // overlap between many of them (see resize's own density) that
        // builds up a continuous haze rather than visible circles.
        gradient.addColorStop(0, `rgba(${vaporR}, ${vaporG}, ${vaporB}, ${puff.opacity})`)
        gradient.addColorStop(1, `rgba(${vaporR}, ${vaporG}, ${vaporB}, 0)`)
        ctx!.fillStyle = gradient
        ctx!.beginPath()
        ctx!.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    function drawVapor() {
      // Far layer first, near layer on top — matches the draw order a
      // real depth-sorted fog bank would use, though since both are
      // semi-transparent the visual difference is subtle either way.
      drawPuffs(farPuffs)
      drawPuffs(nearPuffs)
    }

    function draw(time: number) {
      ctx!.clearRect(0, 0, width, height)
      if (effect === 'rain') drawRain()
      else if (effect === 'vapor') drawVapor()
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
      } else if (effect === 'vapor') {
        for (const puff of [...farPuffs, ...nearPuffs]) {
          puff.x += puff.vx
          puff.y += puff.vy + Math.sin(time * 0.0003 + puff.bobPhase) * (puff.bobAmp / 250)
          // Wraps back in from the opposite edge once fully off-screen —
          // whichever direction it's drifting, not just left-to-right.
          if (puff.x - puff.radius > width) puff.x = -puff.radius
          else if (puff.x + puff.radius < 0) puff.x = width + puff.radius
        }
      }
      draw(time)
      frame = requestAnimationFrame(step)
    }

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(frame)
    }
  }, [effect, color])

  if (!isEffectValue(effect)) return null

  return <canvas ref={canvasRef} className="fixed inset-0 z-[1] pointer-events-none" aria-hidden="true" />
}
