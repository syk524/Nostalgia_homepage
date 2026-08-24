'use client'
import { useEffect, useRef, useState } from 'react'
import { PairLink } from '@/components/pair-link'
import { pairFontFamily } from '@/lib/fonts'
import type { ProfileCharacter } from '@/types/database'

// Catchphrase as plain text (no pill), then name, then the quote — each with
// its own independently selectable font and color.
function CharacterCaption({ character, align, isOpen, isClosing, onToggle }: {
  character: ProfileCharacter
  align: 'left' | 'right'
  // Mobile-only (below 1020px, this page's own breakpoint — reported
  // directly, not Tailwind's default sm:/lg:) — full captions overlaid an
  // image barely 60vw of a narrow screen read as cramped, so below 1020px
  // they collapse behind a shimmering dot (this character's own
  // name_underline_color) until tapped open. 1020px and up ignore all
  // three of these and stay exactly as they always have — see the
  // min-[1020px]:! overrides on .t-caption-popout below.
  isOpen: boolean
  isClosing: boolean
  onToggle: () => void
}) {
  // A zero-offset, blurred text-shadow reads as a soft halo/border around
  // the letterforms rather than a directional drop shadow — user-set
  // color and strength (blur radius, in px), one shared value for all
  // three caption lines rather than a separate control per field. This is
  // layered on top of the existing drop-shadow filter (kept for legibility
  // against busy photo backgrounds) — text-shadow and filter:drop-shadow
  // are independent properties, so both apply without conflict.
  const textShadow = `0 0 ${character.caption_shadow_strength}px ${character.caption_shadow_color}`
  return (
    // caption_offset_y nudges just this character up/down from the shared
    // row's own centered position (set on the row in CharacterPairHero) —
    // a transform, not a margin: margin participates in the flex row's
    // own align-items:center calculation (each item centers within a line
    // whose cross-axis size includes margins), so unequal margins between
    // the two captions shifted the row's centering itself and produced
    // less separation than the margin values implied. A transform is a
    // pure paint-time offset, invisible to that layout math, so it's an
    // exact 1:1 pixel shift. The mobile open/close scale transition lives
    // on the INNER .t-caption-popout div instead of sharing this one —
    // two different `transform`s on the same element would just clobber
    // each other (same class of bug as animate-fade-up's own translateY
    // elsewhere in this app).
    <div className={`relative max-w-[650px] ${align === 'right' ? 'text-right' : 'text-left'}`} style={{ transform: `translateY(${character.caption_offset_y}px)` }}>
      {/* Stays fully visible/clickable whether open or closed — reported
          directly, so tapping the same dot again is what closes the info
          (aria-label/aria-expanded already reflect whichever action that
          tap will now perform). Only the shimmer animation itself pauses
          while open, via caption-dot-open below, so an already-open dot
          reads as "on" rather than still pulsing "tap me". z-10 is load-
          bearing, not decorative: .t-caption-popout's own `transform`
          (for its open/close scale animation) creates a stacking context,
          which paints it above this absolute-positioned button by default
          once it goes pointer-events:auto on open — since its padding-box
          (pt-7 below) physically overlaps this same top-0/right-0-or-
          left-0 16×16 corner, that swallowed the tap meant for the dot
          and the info couldn't be closed by tapping it again, reported
          directly. z-10 gives the button an explicit stacking order the
          popout's default (z-index:auto) can't beat, regardless of which
          one is later in the DOM. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? `Hide ${character.name}’s info` : `Show ${character.name}’s info`}
        aria-expanded={isOpen}
        className={`caption-dot min-[1020px]:hidden absolute top-0 z-10 w-4 h-4 rounded-full pointer-events-auto ${isOpen ? 'caption-dot-open' : ''} ${align === 'right' ? 'right-0' : 'left-0'}`}
        style={{ background: character.name_underline_color, boxShadow: `0 0 10px ${character.name_underline_color}` }}
      />
      {/* min-[1020px]:!-prefixed utilities beat .t-caption-popout's own
          (non-!important) opacity/transform/pointer-events at that
          breakpoint and up, regardless of is-open/is-closing — that's what
          keeps desktop's always-visible behavior completely unchanged.
          pt-7 (mobile only) reserves room for the dot above so the info
          unfolds below it instead of overlapping it — desktop's dot is
          hidden entirely (min-[1020px]:hidden above), so it gets no top
          padding of its own. */}
      <div
        className={`t-caption-popout pt-7 min-[1020px]:pt-0 min-[1020px]:!opacity-100 min-[1020px]:!scale-100 min-[1020px]:!pointer-events-auto ${isOpen ? 'is-open' : isClosing ? 'is-closing' : ''}`}
        data-origin={align === 'right' ? 'top-right' : 'top-left'}
      >
        {character.catchphrase && (
          // letter-spacing doesn't accept percentages in CSS — 140% is
          // expressed as 1.4em, i.e. 140% of the font size, the standard
          // reading of a percentage tracking value. letter-spacing adds
          // its gap after every character, including the last one — with
          // text-align:right (align === 'right', inherited from the outer
          // wrapper) that trailing 1.4em counts toward the line's measured
          // width, so the browser right-aligns to a box that's 1.4em wider
          // than the visible glyphs and the actual text reads as sitting
          // short of the name/quote/keywords' own flush-right edge below
          // it, reported directly. A matching -1.4em margin-right cancels
          // that phantom trailing gap so the last glyph itself lands flush
          // right; left-aligned is unaffected (the trailing gap falls
          // after the text either way, off to the right, not before it).
          <p
            className="drop-shadow"
            style={{
              fontFamily: pairFontFamily(character.catchphrase_font), color: character.catchphrase_color,
              fontSize: 14, letterSpacing: '1.4em', textShadow,
              marginRight: align === 'right' ? '-1.4em' : undefined,
              paddingBottom: 2,
            }}
          >{character.catchphrase}</p>
        )}
        {/* 1.25x the previous text-xl/text-2xl (20px/24px) — 25px/30px,
            not a step up to the next Tailwind size (2xl/3xl), which would
            overshoot the exact ratio asked for. */}
        <h3 className="text-[25px] min-[1020px]:text-[30px] drop-shadow-md leading-tight" style={{ fontFamily: pairFontFamily(character.name_font), color: character.name_color, textShadow }}>{character.name}</h3>
        {/* Per-character color, not the catchphrase divider's old fixed
            bg-white/60 — always shown (not gated on catchphrase like that
            one was), since this reads as the name's own underline now,
            not a catchphrase/name separator. */}
        <div className={`h-px max-w-[200px] my-2 ${align === 'right' ? 'ml-auto' : ''}`} style={{ background: character.name_underline_color }} />
        {character.quote && (
          // Narrower than the 650px caption block above it, so it wraps
          // sooner — ml-auto (mirroring the divider line) keeps its right
          // edge flush with the wider name/catchphrase when right-aligned,
          // instead of the shrunk box just sitting left-anchored inside the
          // wider container.
          <p className={`text-xl min-[1020px]:text-2xl drop-shadow mt-1 max-w-[350px] ${align === 'right' ? 'ml-auto' : ''}`} style={{ fontFamily: pairFontFamily(character.quote_font), color: character.quote_color, textShadow }}>“{character.quote}”</p>
        )}
        {(character.keyword_1 || character.keyword_2 || character.keyword_3) && (
          // One shared font/color for all three keywords (not per-keyword),
          // same text-shadow as the rest of the caption. Each non-empty
          // keyword gets a # prefix; empty slots are just skipped, not
          // rendered as a stray "#". Rendered as separate flex items with a
          // gap instead of one string joined by plain spaces — a fixed gap
          // is a more reliable, adjustable way to widen the spacing between
          // keywords than relying on however wide a literal space character
          // renders at this font. justify-end mirrors the ml-auto/text-right
          // treatment the rest of this block uses when right-aligned.
          // text-sm matches the description body's own text size exactly
          // (character-pair-detail.tsx's section paragraphs use the same
          // class) rather than a separately-set px value that only
          // coincidentally lined up.
          <div
            className={`drop-shadow mt-1 flex flex-wrap gap-3 text-sm ${align === 'right' ? 'justify-end' : ''}`}
            style={{ fontFamily: pairFontFamily(character.keyword_font), color: character.keyword_color, textShadow }}
          >
            {[character.keyword_1, character.keyword_2, character.keyword_3].filter(Boolean).map((k, i) => (
              <span key={i}>#{k}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// The pair title sits as a plain heading above the image (normal flow, not
// overlaid — no background pill needed since it's not sitting on top of
// arbitrary photo content). Character captions sit flush against the
// left/right edges of the full content container — measured against the
// full page content width, not the narrower (60vw) image itself, which is
// why the image sits in its own inner wrapper while the overlay is
// positioned against the outer, full-width one.
export function CharacterPairHero({
  imageUrl, illustrationSource, illustrationSourceFont, illustrationSourceColor,
  title, titleFont, titleColor, titleSize, linkText, linkUrl, linkFont, linkColor, hasMusic, char1, char2,
}: {
  imageUrl: string
  illustrationSource: string | null
  illustrationSourceFont: string
  illustrationSourceColor: string
  title: string
  titleFont: string
  titleColor: string
  titleSize: number
  linkText: string | null
  linkUrl: string | null
  linkFont: string
  linkColor: string
  hasMusic: boolean
  char1?: ProfileCharacter
  char2?: ProfileCharacter
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [captionTop, setCaptionTop] = useState<number | null>(null)
  // Mobile-only caption popout state — which character (if any) is open,
  // and which (if any) is mid-close. Independent per character, not one
  // boolean, since either dot can be tapped open on its own. closingChar
  // only exists for the is-open→is-closing→(removed) transition dance
  // .t-caption-popout expects (see its own comment in globals.css) — the
  // timeout below has to match --caption-popout-close-dur there.
  const [openChar, setOpenChar] = useState<'char1' | 'char2' | null>(null)
  const [closingChar, setClosingChar] = useState<'char1' | 'char2' | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function toggleCaption(which: 'char1' | 'char2') {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    if (openChar === which) {
      setOpenChar(null)
      setClosingChar(which)
      closeTimerRef.current = setTimeout(() => setClosingChar(null), 150)
    } else {
      setClosingChar(null)
      setOpenChar(which)
    }
  }

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
      {/* Grouped in their own div, not left as two direct children of the
          space-y-4 above — space-y's `> * ~ *` selector outranks a plain
          mt-2 on specificity, so PairLink's own 8px gap would just lose to
          space-y-4's 16px if it sat at that level. Nesting one level down
          keeps space-y-4 governing only the gap to the image container
          below, letting PairLink's own margin set the title-to-link gap
          precisely. */}
      <div>
        {/* titleSize is a flat px value the user picks with no screen size
            in mind — fine on a wide desktop viewport, but on a narrow
            phone a title long enough to matter at 60-80px would wrap onto
            a second line, reported directly. clamp()'s middle (preferred)
            branch scales continuously with viewport width instead of
            switching at one fixed breakpoint, so it shrinks smoothly as
            the screen narrows; the 28px floor keeps very small screens
            legible, and the ${titleSize}px ceiling is what keeps this a
            no-op at desktop widths — once 9vw grows past the user's own
            size, clamp caps back to exactly what they set, unchanged from
            before this fix. */}
        <h1 className="text-center" style={{ fontFamily: pairFontFamily(titleFont), color: titleColor, fontSize: `clamp(28px, 9vw, ${titleSize}px)` }}>{title}</h1>
        <PairLink text={linkText} url={linkUrl} font={linkFont} color={linkColor} hasMusic={hasMusic} centered />
      </div>

      <div ref={containerRef} className="relative w-full">
        {/* Full width (just the page's own px-6) below 1020px instead of
            the desktop 60vw column — reported directly, so the pair art
            fills the narrower phone screen properly instead of sitting in
            a comparatively small centered strip with dead space on either
            side. min-[1020px]:w-[60vw] keeps desktop exactly as it was. */}
        <div className="w-full min-[1020px]:w-[60vw] mx-auto">
          <img src={imageUrl} alt="" className="w-full h-auto block rounded" />
          {illustrationSource && (
            <p className="text-center text-sm mt-3" style={{ fontFamily: pairFontFamily(illustrationSourceFont), color: illustrationSourceColor }}>
              ©{illustrationSource}
            </p>
          )}
        </div>

        {/* right side matches Nav's own right-[2.6%] inset — the
            container this is positioned against carries its own right
            padding from the outer content wrapper (character-pair-
            detail.tsx: px-4/1rem on mobile, min-[1020px]:pr-6/1.5rem on
            desktop), so the offset here is the delta from THAT value up
            to the vw-scaled 2.6% nav uses, same calc() pattern as the
            back button fix in character-pair-detail.tsx — kept in sync
            with that wrapper's own two values rather than the single
            1.5rem this used before both were mobile/desktop-specific. */}
        <div
          className="absolute left-0 right-[calc(2.6vw-1rem)] min-[1020px]:right-[calc(2.6vw-1.5rem)] flex items-center justify-between gap-6 pointer-events-none"
          style={{ top: captionTop !== null ? `${captionTop}px` : '50%', transform: 'translateY(-50%)' }}
        >
          {char1 && (
            <CharacterCaption
              character={char1}
              align="left"
              isOpen={openChar === 'char1'}
              isClosing={closingChar === 'char1'}
              onToggle={() => toggleCaption('char1')}
            />
          )}
          {char2 && (
            <CharacterCaption
              character={char2}
              align="right"
              isOpen={openChar === 'char2'}
              isClosing={closingChar === 'char2'}
              onToggle={() => toggleCaption('char2')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
