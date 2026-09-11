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
// instead of pre-baked letter paths). Decorative and inert — aria-hidden,
// pointer-events-none — except the "T", which is a real link out to the
// project's X account (below); only ever mounted for a non-default theme
// (see draggable-home-scene.tsx).
//
// ripple (default true) passes straight through to NoirParticleField —
// draggable-home-scene.tsx sets it false for the Illust theme, whose own
// background is a full illustration rather than Noir's plain backdrop.
// particles (default true) skips NoirParticleField entirely — per direct
// follow-up request, Illust drops the grid/twinkle field and its cursor-
// repulsion hover effect too, not just the ripple, leaving only the
// grain-filtered wordmark below over the illustration.
export function NoirBackground({ ripple = true, particles = true }: { ripple?: boolean; particles?: boolean } = {}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles && <NoirParticleField ripple={ripple} />}

      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <filter id="noir-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves={3} seed={5} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={6} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      {WORDMARK_LETTERS.map((l, i) => {
        const glyphStyle = {
          fontFamily: 'var(--font-playfair-display), Georgia, serif',
          fontSize: l.size,
          transform: `rotate(${l.rotate}deg)`,
          filter: 'url(#noir-grain)',
        }
        // The "T" doubles as a CTA out to the project's X account — per
        // direct request, with the same hover-label treatment as the
        // sticker desk's own app icons (thought-tt-*, globals.css;
        // desk-app-icon.tsx is the other user of that pattern). Every
        // other letter stays a plain aria-hidden span, inert like before.
        // Position moves from this span onto the wrapping <a> below (its
        // own inline `position: absolute` deliberately, not the Tailwind
        // `absolute` class every other letter uses here — thought-tt-wrap
        // sets `position: relative` at the same class specificity, and an
        // inline style is the only way to guarantee this one wins over
        // that regardless of stylesheet order).
        // pointer-events-none below 1020px (this codebase's own desktop
        // cutoff, matching Nav's own switch point) up to min-[1020px]:
        // pointer-events-auto above it — per direct request, both the
        // hover label and the click-through should only ever be reachable
        // on a desktop-sized screen, not tablet or phone; below that
        // width this falls back to the container's own pointer-events-
        // none like every other letter, and (since a pointer-events-none
        // element can't register :hover at all) the tooltip and the
        // click both go inert together with one class, no separate touch
        // check needed.
        // The tooltip's own `bottom` is nudged in via inline style (8px
        // gap from .thought-tt's own rule down to 3px) — inline style
        // beats that class regardless of stylesheet order, same reasoning
        // as the position override above; the hover rule that toggles
        // opacity/transform doesn't touch `bottom`, so this applies in
        // both states without fighting that rule.
        if (l.char === 'T') {
          return (
            <a
              key={i}
              href="https://x.com/Nustalgio"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Nustalgio on X"
              className="thought-tt-wrap pointer-events-none min-[1020px]:pointer-events-auto text-white/80 hover:text-white transition-colors select-none"
              style={{ position: 'absolute', top: l.top, left: l.left }}
            >
              <span className="thought-tt-trigger inline-block" style={glyphStyle}>{l.char}</span>
              <span className="thought-tt thought-tt-dark font-sans text-[9px] uppercase tracking-wide whitespace-nowrap" style={{ bottom: 'calc(100% + 3px)' }}>@Nustalgio</span>
            </a>
          )
        }
        return (
          <span
            key={i}
            aria-hidden="true"
            className="absolute text-white/80 select-none"
            style={{ top: l.top, left: l.left, ...glyphStyle }}
          >
            {l.char}
          </span>
        )
      })}
    </div>
  )
}
