'use client'
import { useEffect, useRef } from 'react'

// The dropdown in new/edit-session-form.tsx is driven off this list, not
// hardcoded options — adding a future effect (snow, embers, …) means
// adding an entry here, a spawn/draw pair below, and one branch in the
// two switches inside ParticleEffect, nothing else.
export const PARTICLE_EFFECTS = [
  { value: 'rain', label: 'Rain' },
  { value: 'stars', label: 'Stars' },
  { value: 'shooting-stars', label: 'Shooting Stars' },
  { value: 'snow', label: 'Snow' },
  { value: 'light', label: 'Light' },
  { value: 'star-voyage', label: 'Star Voyage' },
  { value: 'water', label: 'Water' },
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
  'shooting-stars': '#ffffff',
  snow: '#ffffff',
  light: '#9fd0ff',
  'star-voyage': '#ffffff',
  water: '#6fb3ff',
}

// Canvas fillStyle/strokeStyle both accept a plain hex string directly,
// but a radial gradient needs its own alpha per stop (rgba(), not hex),
// so this is only ever called from drawWater. Falls back to a neutral
// dark default's own components on a malformed hex rather than throwing —
// this only ever receives either a built-in default or something the
// color picker's own regex already validated, but a bad value here
// should never crash the whole effect.
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return [8, 8, 10]
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

// Two-digit hex alpha suffix for a plain "#rrggbb" fillStyle/strokeStyle —
// same trick drawShootingStars already uses for its transparent gradient
// stop (`${resolvedColor}00`), generalized to any alpha rather than just
// fully-transparent.
function alphaHex(alpha: number): string {
  return Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0')
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

// A rare bright streak crossing the sky, on top of the same ambient
// twinkling field 'stars' already draws — reference:
// innocent-aim-546625.framer.app. Ages in frames (framesAlive vs
// lifespanFrames), same simple-per-frame-increment convention as drops
// above rather than real elapsed-ms, so it stays consistent with the
// rest of this file. Diagonal, upper-left toward lower-right
// (a fixed narrow angle band, not fully random direction) — matches the
// reference's own single consistent travel direction rather than
// streaks crossing every which way.
type ShootingStar = {
  x: number; y: number
  angle: number
  speed: number
  length: number
  framesAlive: number
  lifespanFrames: number
}

function randomShootingStar(width: number, height: number): ShootingStar {
  return {
    x: Math.random() * width,
    // Starts somewhere in the upper half — reported directly, spawning
    // low left too little room to trace a visible streak before exiting
    // the bottom edge.
    y: Math.random() * height * 0.5,
    angle: Math.PI * 0.2 + Math.random() * Math.PI * 0.1,
    // Slower per repeated direct request — lifespanFrames scaled up
    // alongside each slowdown (52.5 → 105 → 140 → 195 frames on average)
    // so the streak still crosses about the same total distance each
    // time, just more gradually, rather than crawling a shorter distance
    // at the old duration.
    speed: 2.5 + Math.random() * 1.5,
    length: 70 + Math.random() * 70,
    framesAlive: 0,
    lifespanFrames: 150 + Math.random() * 90,
  }
}

// Same straight-down-plus-sway drift as a classic CSS snowfall effect
// (each particle drifts straight down at its own speed while swaying
// side to side on a sine wave, wraps back to the top once it's fully
// off the bottom, no cursor interaction), rendered as a plain filled
// circle rather than a glyph. Sway is continuous (driven by elapsed
// time, not per-frame accumulation), so it stays perfectly periodic no
// matter how long the animation has been running, unlike nudging x by a
// per-frame delta.
type Snowflake = {
  x: number; y: number; radius: number; speed: number
  swayAmp: number; swayFreq: number; swayPhase: number; opacity: number
}

function randomSnowflake(width: number, height: number, atRandomHeight: boolean): Snowflake {
  return {
    x: Math.random() * width,
    y: atRandomHeight ? Math.random() * height : -10,
    radius: 1.5 + Math.random() * 2.5,
    speed: 0.4 + Math.random() * 0.9,
    swayAmp: 10 + Math.random() * 20,
    swayFreq: 0.0004 + Math.random() * 0.0006,
    swayPhase: Math.random() * Math.PI * 2,
    opacity: 0.4 + Math.random() * 0.5,
  }
}

// A star flying straight outward from a fixed center, accelerating the
// farther out it gets — reference: star-effect.framer.website, which
// (confirmed by sampling its canvas twice 800ms apart — every bright
// pixel had moved, nothing held still) turned out to be a moving warp
// field rather than a plain twinkling one, matching its own "voyage"
// name. dist/speed only, no x/y — position is derived from the shared
// center each frame, same as shooting stars derive their tail from a
// single angle+length rather than storing two endpoints.
type WarpStar = { angle: number; dist: number; speed: number }

function randomWarpStar(maxDist: number): WarpStar {
  return {
    angle: Math.random() * Math.PI * 2,
    // Staggered starting distance, not all pinned to the exact center —
    // spawning every star at dist 0 would have them all pop into
    // existence in a single frame's tiny dot, then take the same amount
    // of time to reach a visible streak length; staggering means the
    // field always has stars at every stage of the fly-by, right from
    // the very first frame.
    dist: Math.random() * maxDist * 0.6,
    speed: 0.6 + Math.random() * 0.6,
  }
}

// Calm, slow-breathing glow — reference: calmwatershader.framer.ai (the
// site's own shooting star excluded per direct request; only the ambient
// blue light-through-water glow is reproduced here). A handful of large,
// heavily-blurred radial blobs drifting sideways at a near-imperceptible
// speed, each pulsing its own opacity slowly out of phase with the
// others so the glow reads as shifting light rather than a static wash.
type WaterGlow = {
  x: number; y: number; radius: number; vx: number
  opacityBase: number; pulseSpeed: number; pulsePhase: number
}

function randomWaterGlow(width: number, height: number): WaterGlow {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 140 + Math.random() * 180,
    vx: (Math.random() - 0.5) * 0.05,
    opacityBase: 0.1 + Math.random() * 0.12,
    pulseSpeed: 0.15 + Math.random() * 0.25,
    pulsePhase: Math.random() * Math.PI * 2,
  }
}

// A thin horizontal shimmer line, undulating via a sine wave sampled
// across x — same "compute purely from elapsed time, don't accumulate a
// per-frame offset" approach as the snow sway, so it stays perfectly
// periodic no matter how long the effect has been running.
type WaterRipple = {
  y: number; amplitude: number; frequency: number
  phase: number; speed: number; opacity: number
}

function randomWaterRipple(height: number, index: number, count: number): WaterRipple {
  return {
    // Evenly spread top-to-bottom rather than fully random — a random Y
    // per ripple risks two landing close together (reads as one thick
    // band) or a wide empty gap; even spacing guarantees coverage.
    y: (height * (index + 1)) / (count + 1),
    amplitude: 6 + Math.random() * 10,
    frequency: 0.006 + Math.random() * 0.01,
    phase: Math.random() * Math.PI * 2,
    speed: 0.0004 + Math.random() * 0.0006,
    opacity: 0.07 + Math.random() * 0.08,
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
    // drawWater's glow blobs need the resolved color as rgba() components
    // for a radial gradient, not just a flat fillStyle string.
    const [colorR, colorG, colorB] = hexToRgb(resolvedColor)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let drops: Drop[] = []
    let stars: Star[] = []
    let snowflakes: Snowflake[] = []
    let warpStars: WarpStar[] = []
    let waterGlows: WaterGlow[] = []
    let waterRipples: WaterRipple[] = []
    // Populated over time by step() below, not up front — a shooting
    // star is a rare, short-lived event, not a standing population like
    // every other particle type here.
    let shootingStars: ShootingStar[] = []
    let framesUntilNextShootingStar = 0

    function resize() {
      width = canvas!.width = window.innerWidth
      height = canvas!.height = window.innerHeight
      if (effect === 'rain') {
        drops = Array.from({ length: Math.round((width * height) / 9000) }, () => randomDrop(width, height, true))
      } else if (effect === 'snow') {
        snowflakes = Array.from({ length: Math.round((width * height) / 9000) }, () => randomSnowflake(width, height, true))
      } else if (effect === 'star-voyage') {
        // Cleared and respawned on resize (not repositioned) — like
        // shooting stars, a mid-flight warp star's angle/distance only
        // make sense relative to the viewport size it was spawned at.
        const maxDist = Math.hypot(width, height) / 2 + 40
        warpStars = Array.from({ length: Math.max(40, Math.round((width * height) / 7000)) }, () => randomWarpStar(maxDist))
      } else if (effect === 'water') {
        const area = width * height
        waterGlows = Array.from({ length: Math.max(3, Math.round(area / 480000)) }, () => randomWaterGlow(width, height))
        const rippleCount = 5
        waterRipples = Array.from({ length: rippleCount }, (_, i) => randomWaterRipple(height, i, rippleCount))
      } else {
        // 'shooting-stars' gets a denser ambient field than plain 'stars'
        // — a smaller divisor, more stars per unit area — per direct
        // request, kept scoped to this one effect rather than changing
        // 'stars' itself for every existing TRPG session already using it.
        const starDivisor = effect === 'shooting-stars' ? 3500 : 6000
        stars = Array.from({ length: Math.round((width * height) / starDivisor) }, () => randomStar(width, height))
        // Cleared rather than repositioned on resize — a mid-flight
        // streak's own start/end make sense only for the viewport size
        // it was spawned at; step() below spawns a fresh one shortly
        // after anyway.
        if (effect === 'shooting-stars') shootingStars = []
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

    function drawShootingStars() {
      ctx!.lineWidth = 3
      ctx!.lineCap = 'round'
      for (const s of shootingStars) {
        const t = s.framesAlive / s.lifespanFrames
        // Fades in over the first 15% of its life, then fades back out
        // over the rest — never sits at full brightness for a hard-edged
        // stretch the way a flat opacity would.
        const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
        const tailX = s.x - Math.cos(s.angle) * s.length
        const tailY = s.y - Math.sin(s.angle) * s.length
        // Gradient along the streak itself, transparent tail to bright
        // head — a flat stroke color would read as a rigid bar, not a
        // trail fading away behind a moving point.
        const gradient = ctx!.createLinearGradient(tailX, tailY, s.x, s.y)
        gradient.addColorStop(0, `${resolvedColor}00`)
        gradient.addColorStop(1, resolvedColor)
        ctx!.strokeStyle = gradient
        ctx!.globalAlpha = fade
        ctx!.beginPath()
        ctx!.moveTo(tailX, tailY)
        ctx!.lineTo(s.x, s.y)
        ctx!.stroke()
      }
      ctx!.globalAlpha = 1
    }

    // A soft diagonal godray fanning down from the upper-right corner
    // over the ambient star field drawStars already renders — reference:
    // excited-fancy-786074.framer.app. Three overlapping rays at slightly
    // different angles/widths instead of one flat beam, since a single
    // gradient rectangle read as a plain stripe rather than the
    // reference's fanned, feathered light. Breathes slowly (a sine on
    // time, not a fixed opacity) rather than sitting static — a light
    // source that never varies read as a flat image, not an atmosphere.
    function drawLightBeam(time: number) {
      const originX = width * 0.85
      const originY = -height * 0.1
      const beamLength = Math.max(width, height) * 1.8
      const pulse = 0.7 + 0.3 * Math.sin(time * 0.00035)
      const rays = [
        { angleOffset: -0.09, width: 0.5, opacity: 0.16 },
        { angleOffset: 0, width: 0.32, opacity: 0.22 },
        { angleOffset: 0.09, width: 0.42, opacity: 0.14 },
      ]
      for (const ray of rays) {
        ctx!.save()
        ctx!.translate(originX, originY)
        ctx!.rotate(Math.PI * 0.25 + ray.angleOffset)
        const beamWidth = Math.min(width, height) * ray.width
        const gradient = ctx!.createLinearGradient(-beamWidth / 2, 0, beamWidth / 2, 0)
        gradient.addColorStop(0, `${resolvedColor}00`)
        gradient.addColorStop(0.5, `${resolvedColor}${alphaHex(ray.opacity * pulse)}`)
        gradient.addColorStop(1, `${resolvedColor}00`)
        ctx!.fillStyle = gradient
        ctx!.fillRect(-beamWidth / 2, 0, beamWidth, beamLength)
        ctx!.restore()
      }
    }

    // Hyperspace fly-by — every star races outward from a shared center,
    // accelerating (not constant speed) so the field reads as travel
    // toward the viewer rather than a uniform outward drift. Reference:
    // star-effect.framer.website.
    function drawWarpStars() {
      const cx = width / 2
      const cy = height / 2
      ctx!.lineCap = 'round'
      for (const s of warpStars) {
        // Fades in over its first stretch from center — otherwise a
        // freshly spawned star pops in at full brightness right next to
        // wherever the last one just vanished, reported as distracting
        // in the shooting-star effect's own early tuning.
        const fade = Math.min(1, s.dist / 60)
        const tailDist = Math.max(0, s.dist - (8 + s.speed * 6))
        const cos = Math.cos(s.angle)
        const sin = Math.sin(s.angle)
        const headX = cx + cos * s.dist
        const headY = cy + sin * s.dist
        const tailX = cx + cos * tailDist
        const tailY = cy + sin * tailDist
        const gradient = ctx!.createLinearGradient(tailX, tailY, headX, headY)
        gradient.addColorStop(0, `${resolvedColor}00`)
        gradient.addColorStop(1, resolvedColor)
        ctx!.strokeStyle = gradient
        ctx!.globalAlpha = fade
        // Thicker the faster (= farther along) a star is, matching a
        // real fly-by where nearer stars appear to streak past wider.
        ctx!.lineWidth = 1 + Math.min(2, s.speed * 0.5)
        ctx!.beginPath()
        ctx!.moveTo(tailX, tailY)
        ctx!.lineTo(headX, headY)
        ctx!.stroke()
      }
      ctx!.globalAlpha = 1
    }

    function drawSnow(time: number) {
      ctx!.fillStyle = resolvedColor
      for (const flake of snowflakes) {
        const swayX = flake.x + Math.sin(time * flake.swayFreq + flake.swayPhase) * flake.swayAmp
        ctx!.globalAlpha = flake.opacity
        ctx!.beginPath()
        ctx!.arc(swayX, flake.y, flake.radius, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
    }

    // Ambient light-through-water glow plus a few undulating shimmer
    // lines — reference: calmwatershader.framer.ai, minus the shooting
    // star that site also had, per direct request (that streak effect
    // already exists here as its own 'shooting-stars' option).
    function drawWater(time: number) {
      ctx!.filter = 'blur(24px)'
      for (const g of waterGlows) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 0.0006 * g.pulseSpeed + g.pulsePhase)
        const gradient = ctx!.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.radius)
        gradient.addColorStop(0, `rgba(${colorR}, ${colorG}, ${colorB}, ${g.opacityBase * pulse})`)
        gradient.addColorStop(1, `rgba(${colorR}, ${colorG}, ${colorB}, 0)`)
        ctx!.fillStyle = gradient
        ctx!.beginPath()
        ctx!.arc(g.x, g.y, g.radius, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.filter = 'none'

      ctx!.strokeStyle = resolvedColor
      ctx!.lineWidth = 1.5
      for (const ripple of waterRipples) {
        ctx!.globalAlpha = ripple.opacity
        ctx!.beginPath()
        for (let x = 0; x <= width; x += 12) {
          const y = ripple.y + Math.sin(x * ripple.frequency + time * ripple.speed + ripple.phase) * ripple.amplitude
          if (x === 0) ctx!.moveTo(x, y)
          else ctx!.lineTo(x, y)
        }
        ctx!.stroke()
      }
      ctx!.globalAlpha = 1
    }

    function draw(time: number) {
      ctx!.clearRect(0, 0, width, height)
      if (effect === 'rain') drawRain()
      else if (effect === 'snow') drawSnow(time)
      else if (effect === 'water') drawWater(time)
      else if (effect === 'star-voyage') drawWarpStars()
      else {
        drawStars(time)
        if (effect === 'shooting-stars') drawShootingStars()
        else if (effect === 'light') drawLightBeam(time)
      }
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
      } else if (effect === 'snow') {
        for (const flake of snowflakes) {
          flake.y += flake.speed
          if (flake.y - flake.radius > height) Object.assign(flake, randomSnowflake(width, height, false))
        }
      } else if (effect === 'star-voyage') {
        const maxDist = Math.hypot(width, height) / 2 + 40
        for (const s of warpStars) {
          s.dist += s.speed
          // Accelerates the farther out it travels — a constant speed
          // read as a uniform drift rather than a fly-by rushing past.
          s.speed += 0.025
          if (s.dist > maxDist) Object.assign(s, randomWarpStar(maxDist))
        }
      } else if (effect === 'water') {
        for (const g of waterGlows) {
          g.x += g.vx
          if (g.x - g.radius > width) g.x = -g.radius
          else if (g.x + g.radius < 0) g.x = width + g.radius
        }
        // Ripples need no per-frame position update — their undulation is
        // computed straight from elapsed time in drawWater, same as the
        // snow sway above.
      } else if (effect === 'shooting-stars') {
        // Ambient stars need no per-frame update at all (their twinkle is
        // computed straight from time in drawStars) — only the rare
        // streaks have anything to spawn/age/move here.
        framesUntilNextShootingStar--
        // Cap raised alongside the higher frequency below (3, was 2) —
        // streaks now also live roughly twice as long (slower, per
        // direct request), so more can be in flight at once; the old
        // cap would otherwise silently swallow a spawn that's due while
        // two slow ones are still finishing.
        if (framesUntilNextShootingStar <= 0 && shootingStars.length < 3) {
          shootingStars.push(randomShootingStar(width, height))
          // Every ~1-2.5s at a typical 60fps — more frequent than an
          // earlier ~2.5-6.5s, per direct request, while staying
          // irregular rather than a predictable metronome.
          framesUntilNextShootingStar = 60 + Math.random() * 90
        }
        for (const s of shootingStars) {
          s.framesAlive++
          s.x += Math.cos(s.angle) * s.speed
          s.y += Math.sin(s.angle) * s.speed
        }
        shootingStars = shootingStars.filter(s => s.framesAlive < s.lifespanFrames)
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
