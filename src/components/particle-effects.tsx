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

// Individual puffy cloud formations, not a uniform haze. Each cloud is a
// cluster of several overlapping lobe-circles laid out along a rounded
// hump (tall and bunched in the middle, tapering at the ends, like a
// classic cumulus silhouette) rather than one soft radial blob, so it
// reads as a distinct puffy shape with a bumpy edge instead of a flat
// smudge. Two depth layers as before — "far" smaller/fainter/further
// back, "near" bigger/stronger/in front — but now with real gaps of
// clear background between clusters rather than dense overlap building
// up into one continuous bank, matching the reference's scattered
// individual clouds. Movement is deliberately slow — reported directly
// — and there is no cursor interaction, ever.
type CloudLobe = { dx: number; dy: number; r: number }
type Cloud = {
  x: number; y: number
  vx: number; vy: number
  bobPhase: number; bobAmp: number
  opacity: number
  extent: number // bounding radius, for the off-screen wrap check
  lobes: CloudLobe[]
}

function randomCloud(width: number, height: number, layer: 'far' | 'near'): Cloud {
  const isFar = layer === 'far'
  const baseSize = isFar ? 70 + Math.random() * 60 : 120 + Math.random() * 90
  const lobeCount = 6 + Math.floor(Math.random() * 4)
  const lobes: CloudLobe[] = []
  for (let i = 0; i < lobeCount; i++) {
    const t = i / (lobeCount - 1)
    // Humped envelope: 0 at both ends, 1 in the middle — taller/bigger
    // lobes cluster near the center, small ones taper off at the edges.
    const envelope = Math.sin(t * Math.PI)
    lobes.push({
      dx: (t - 0.5) * baseSize * 1.9,
      dy: -envelope * baseSize * 0.45 + (Math.random() - 0.5) * baseSize * 0.15,
      r: baseSize * (0.3 + envelope * 0.35) * (0.8 + Math.random() * 0.4),
    })
  }
  // A couple of extra top bumps off-center — a plain hump of same-size
  // lobes reads as a loaf, not a cloud; these break that symmetry.
  for (let i = 0; i < 2; i++) {
    const t = 0.3 + Math.random() * 0.4
    lobes.push({
      dx: (t - 0.5) * baseSize * 1.9,
      dy: -baseSize * (0.5 + Math.random() * 0.25),
      r: baseSize * (0.22 + Math.random() * 0.18),
    })
  }

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    // Slow, ambient drift — noticeably slower than an earlier pass,
    // reported directly.
    vx: (isFar ? 0.006 + Math.random() * 0.012 : 0.012 + Math.random() * 0.02) * (Math.random() < 0.5 ? -1 : 1),
    vy: (Math.random() - 0.5) * 0.006,
    bobPhase: Math.random() * Math.PI * 2,
    bobAmp: 4 + Math.random() * 8,
    opacity: isFar ? 0.16 + Math.random() * 0.1 : 0.26 + Math.random() * 0.14,
    extent: baseSize * 1.6,
    lobes,
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
    let farClouds: Cloud[] = []
    let nearClouds: Cloud[] = []

    function resize() {
      width = canvas!.width = window.innerWidth
      height = canvas!.height = window.innerHeight
      if (effect === 'rain') {
        drops = Array.from({ length: Math.round((width * height) / 9000) }, () => randomDrop(width, height, true))
      } else if (effect === 'vapor') {
        // A handful of distinct clusters, not dozens of overlapping
        // puffs — matches the reference's scattered individual clouds
        // with real gaps of background between them.
        const area = width * height
        farClouds = Array.from({ length: Math.max(3, Math.round(area / 420000)) }, () => randomCloud(width, height, 'far'))
        nearClouds = Array.from({ length: Math.max(4, Math.round(area / 280000)) }, () => randomCloud(width, height, 'near'))
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

    function drawClouds(clouds: Cloud[]) {
      for (const cloud of clouds) {
        for (const lobe of cloud.lobes) {
          const cx = cloud.x + lobe.dx
          const cy = cloud.y + lobe.dy
          const gradient = ctx!.createRadialGradient(cx, cy, 0, cx, cy, lobe.r)
          // A continuous center-to-edge fade, not a flat solid core out to
          // some fraction of the radius — a flat plateau's own boundary is
          // a real edge (full opacity right up to it, then falling away)
          // and a large lobe's plateau is wider than the blur in drawVapor
          // can soften, so it showed through as a visible solid-white disc
          // with a hard rim, reported directly. A true gradient has no
          // such boundary anywhere in it for a blur to fail to hide.
          gradient.addColorStop(0, `rgba(${vaporR}, ${vaporG}, ${vaporB}, ${cloud.opacity})`)
          gradient.addColorStop(1, `rgba(${vaporR}, ${vaporG}, ${vaporB}, 0)`)
          ctx!.fillStyle = gradient
          ctx!.beginPath()
          ctx!.arc(cx, cy, lobe.r, 0, Math.PI * 2)
          ctx!.fill()
        }
      }
    }

    function drawVapor() {
      // A modest canvas-level blur melts each cloud's individual lobes
      // together into one puffy body instead of a bunch of visibly
      // separate circles — lighter than a flat haze would need, since
      // too much blur here would smear away the bumpy cumulus silhouette
      // that's the whole point of lobed clusters over a single blob.
      ctx!.filter = 'blur(9px)'
      // Far layer first, near layer on top, for some depth.
      drawClouds(farClouds)
      drawClouds(nearClouds)
      ctx!.filter = 'none'
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
        for (const cloud of [...farClouds, ...nearClouds]) {
          cloud.x += cloud.vx
          cloud.y += cloud.vy + Math.sin(time * 0.0003 + cloud.bobPhase) * (cloud.bobAmp / 250)
          // Wraps back in from the opposite edge once fully off-screen —
          // whichever direction it's drifting, not just left-to-right.
          if (cloud.x - cloud.extent > width) cloud.x = -cloud.extent
          else if (cloud.x + cloud.extent < 0) cloud.x = width + cloud.extent
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
