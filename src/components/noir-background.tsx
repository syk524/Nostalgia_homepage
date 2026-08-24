'use client'
import { NoirParticleField } from '@/components/noir-particle-field'

// Scattered along a rising diagonal, roughly matching the Figma
// reference's composition — hand-placed rather than computed, since
// this is a fixed decorative arrangement, not a dynamic layout.
const WORDMARK_LETTERS: { char: string; top: string; left: string; rotate: number; size: string }[] = [
  { char: 'N', top: '80%', left: '54%', rotate: -4, size: '2.4rem' },
  { char: 'U', top: '86%', left: '60%', rotate: 3, size: '2rem' },
  { char: 'S', top: '75%', left: '65%', rotate: -6, size: '2.6rem' },
  { char: 'T', top: '65%', left: '70%', rotate: 5, size: '3rem' },
  { char: 'A', top: '78%', left: '75%', rotate: -3, size: '2.2rem' },
  { char: 'L', top: '66%', left: '80%', rotate: 4, size: '2.8rem' },
  { char: 'G', top: '74%', left: '85%', rotate: -5, size: '2.4rem' },
  { char: 'I', top: '63%', left: '89%', rotate: 2, size: '3.2rem' },
  { char: 'O', top: '77%', left: '93%', rotate: -4, size: '2.3rem' },
]

// The home page's own Noir decoration: NoirParticleField's shared
// particle backdrop, plus the "NUSTALGIO" wordmark scattered across it
// in a noise-dissolved style (an SVG feTurbulence/feDisplacementMap
// filter, applied here to real DOM text via CSS `filter: url(#...)`
// instead of pre-baked letter paths). Purely decorative — aria-hidden,
// pointer-events-none throughout — and only ever mounted for a
// non-default theme (see draggable-home-scene.tsx).
export function NoirBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <NoirParticleField />

      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id="noir-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves={3} seed={5} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={6} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      {WORDMARK_LETTERS.map((l, i) => (
        <span
          key={i}
          className="absolute text-white/80 select-none"
          style={{
            top: l.top, left: l.left,
            fontFamily: 'var(--font-playfair-display), Georgia, serif',
            fontSize: l.size,
            transform: `rotate(${l.rotate}deg)`,
            filter: 'url(#noir-grain)',
          }}
        >
          {l.char}
        </span>
      ))}
    </div>
  )
}
