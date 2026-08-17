'use client'
import { useEffect, useRef, useState } from 'react'
import { pairFontFamily } from '@/lib/fonts'
import type { Character } from '@/types/database'

// Catchphrase as plain text (no pill), then name, then the quote — each with
// its own independently selectable font and color.
function CharacterCaption({ character, align }: { character: Character; align: 'left' | 'right' }) {
  return (
    <div className={`max-w-[260px] ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {character.catchphrase && (
        <>
          <p className="text-sm drop-shadow" style={{ fontFamily: pairFontFamily(character.catchphrase_font), color: character.catchphrase_color }}>{character.catchphrase}</p>
          <div className="h-px bg-white/60 my-2" />
        </>
      )}
      <h3 className="text-2xl drop-shadow-md leading-tight" style={{ fontFamily: pairFontFamily(character.name_font), color: character.name_color }}>{character.name}</h3>
      {character.quote && (
        <p className="text-sm drop-shadow mt-1" style={{ fontFamily: pairFontFamily(character.quote_font), color: character.quote_color }}>“{character.quote}”</p>
      )}
    </div>
  )
}

// The pair title sits as a plain heading above the image (normal flow, not
// overlaid — no background pill needed since it's not sitting on top of
// arbitrary photo content). Character names stay confined to the left/right
// edges of an 80%-wide centered band — measured against the full page
// content width, not the narrower (60vw) image itself, which is why the
// image sits in its own inner wrapper while the overlay is positioned
// against the outer, full-width one.
export function CharacterPairHero({
  imageUrl, title, titleFont, titleColor, titleSize, char1, char2,
}: {
  imageUrl: string
  title: string
  titleFont: string
  titleColor: string
  titleSize: number
  char1?: Character
  char2?: Character
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [captionTop, setCaptionTop] = useState<number | null>(null)

  // Pins the caption row to the screen's vertical center while the (often
  // very tall) pair image scrolls past, then lets it scroll along with the
  // image once the image's own center catches up to that point — so the
  // captions never sit stranded off-screen below a tall image, but also
  // don't stay glued to the middle of the screen forever once the image
  // has scrolled by. Can't use position:sticky for this: the shared root
  // layout's overflow-hidden (needed to absorb the app's full-bleed
  // breakout overflow) makes it the nearest scrolling ancestor for every
  // sticky element in the app, and since that div never actually scrolls
  // itself, sticky has no real range to work with there and just behaves
  // like plain relative positioning. Computed as position:absolute within
  // this component's own `relative` container instead (not position:fixed
  // — same class of containing-block bug hit earlier this session — so no
  // portal needed here).
  useEffect(() => {
    function update() {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const viewportCenter = window.innerHeight / 2
      setCaptionTop(Math.min(viewportCenter - rect.top, rect.height / 2))
    }

    update()
    // The pair image has no explicit width/height attributes, so its
    // intrinsic aspect ratio — and so the container's real height — isn't
    // known until it finishes loading, which happens after this first
    // measurement with no scroll/resize event to trigger a recompute.
    // A ResizeObserver on the container catches that (and any other cause
    // of the container's own size changing) directly, rather than trying
    // to guess every specific event that could shift it.
    const observer = new ResizeObserver(update)
    if (containerRef.current) observer.observe(containerRef.current)
    document.fonts.ready.then(update)
    // Blunt fallback for any other late layout settling this doesn't
    // otherwise catch.
    const settleTimer = setTimeout(update, 300)
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      clearTimeout(settleTimer)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-center" style={{ fontFamily: pairFontFamily(titleFont), color: titleColor, fontSize: titleSize }}>{title}</h1>

      <div ref={containerRef} className="relative w-full">
        <div className="w-[60vw] mx-auto">
          <img src={imageUrl} alt="" className="w-full h-auto block rounded" />
        </div>

        <div
          className="absolute left-[10%] right-[10%] flex items-center justify-between gap-6 pointer-events-none"
          style={{ top: captionTop !== null ? `${captionTop}px` : '50%', transform: 'translateY(-50%)' }}
        >
          {char1 && <CharacterCaption character={char1} align="left" />}
          {char2 && <CharacterCaption character={char2} align="right" />}
        </div>
      </div>
    </div>
  )
}
