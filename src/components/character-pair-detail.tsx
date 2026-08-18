import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import { DeleteCharacterPairButton } from '@/app/(main)/profile/[slug]/delete-button'
import { CharacterPairHero } from '@/components/character-pair-hero'
import { CharacterPairTimeline } from '@/components/character-pair-timeline'
import { CustomHtmlProfileView } from '@/components/custom-html-profile-view'
import { NavIconColorSetter } from '@/components/nav-icon-color-setter'
import { PairLink } from '@/components/pair-link'
import { PairProfileSideNav } from '@/components/pair-profile-side-nav'
import { ScrollBounceLock } from '@/components/scroll-bounce-lock'
import { pairFontFamily } from '@/lib/fonts'
import type { CharacterPair, PairProfile, ProfileCharacter } from '@/types/database'

// One cell per description section — name/catchphrase/quote already live
// in the overlay above the image, so a repeated name heading here would be
// redundant. No border (this sits directly on the pair's own blurred
// background image, where a boxed outline reads as clutter). Each section
// is its own direct grid item (not nested inside a per-character wrapper)
// so it can be explicitly placed via --section-row/--section-col — see the
// ".description-section-cell" rule in globals.css. Placing both
// characters' section N in the same grid row is what makes them
// top-align, and it's what "reserves empty space" for free: if one
// character has fewer sections, the shorter column's rows just have
// nothing in them, they're never explicitly padded to match, but nothing
// downstream needs that either since these sections are the last thing in
// the row-aligned area. The background glow itself is NOT rendered here
// any more — see the glow wrapper in CharacterPairDetail below for why.
function CharacterDescriptionSections({ character, charIdx }: { character: ProfileCharacter; charIdx: number }) {
  const sections = character.description_sections ?? []
  return (
    <>
      {sections.map((section, sectionIdx) => (
        <div
          key={section.id}
          className={`description-section-cell rounded p-6 sm:w-4/5 sm:max-w-[650px] ${charIdx === 0 ? 'sm:justify-self-start' : 'sm:justify-self-end'}`}
          style={{ '--section-row': sectionIdx + 1, '--section-col': charIdx + 1 } as CSSProperties}
        >
          {section.title && <h3 className="text-2xl mb-2" style={{ color: section.title_color, fontFamily: pairFontFamily(section.title_font) }}>{section.title}</h3>}
          <p className="whitespace-pre-wrap leading-relaxed text-sm" style={{ color: section.text_color }}>{section.description}</p>
        </div>
      ))}
    </>
  )
}

// Fallback for pairs with no pair image to overlay onto — same
// catchphrase → name → quote → description order, in the app's normal
// ink-on-card colors instead of white-on-photo. Sections stay simple
// here: stacked in order inside one shared local glow, no cross-character
// row alignment (that's specifically a full-bleed, side-by-side-photo
// layout concern — this fallback's two cards aren't meant to read as a
// synchronized pair the way the photo-overlay layout is).
function CharacterCard({ character }: { character: ProfileCharacter }) {
  const sections = character.description_sections ?? []
  return (
    <div className="card p-6 space-y-2">
      {character.catchphrase && (
        <>
          <span className="tag inline-block" style={{ fontFamily: pairFontFamily(character.catchphrase_font), color: character.catchphrase_color }}>{character.catchphrase}</span>
          <div className="h-px bg-scroll-300 my-2" />
        </>
      )}
      <h2 className="text-2xl" style={{ fontFamily: pairFontFamily(character.name_font), color: character.name_color }}>{character.name}</h2>
      {character.quote && <p className="italic" style={{ fontFamily: pairFontFamily(character.quote_font), color: character.quote_color }}>“{character.quote}”</p>}
      {sections.length > 0 && (
        <div
          className="-mx-6 -mb-6 px-6 pb-6 pt-2 mt-2 border-t border-scroll-300 rounded-b space-y-4"
          style={{ background: `radial-gradient(ellipse 90% 70% at 50% 100%, ${character.description_color}66 0%, ${character.description_color}00 75%)` }}
        >
          {sections.map(section => (
            <div key={section.id}>
              {section.title && <h3 className="text-lg mb-1" style={{ color: section.title_color, fontFamily: pairFontFamily(section.title_font) }}>{section.title}</h3>}
              <p className="whitespace-pre-wrap leading-relaxed text-sm" style={{ color: section.text_color }}>{section.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function CharacterPairDetail({
  pair, profiles, activeProfile, customHtmlContent, canEdit,
}: {
  pair: CharacterPair
  // Lightweight — just enough for the side-nav, not every profile's full content.
  profiles: { profile_slug: string; profile_title: string; is_primary: boolean }[]
  activeProfile: PairProfile & { profile_characters: ProfileCharacter[] }
  // Pre-fetched raw HTML text for page_type='custom_html' profiles — see
  // custom-html-profile-view.tsx for why this can't just be a URL.
  customHtmlContent?: string | null
  canEdit: boolean
}) {
  const [char1, char2] = [...activeProfile.profile_characters].sort((a, b) => a.slot - b.slot)

  return (
    <div className="relative">
      <NavIconColorSetter color={activeProfile.icon_color} />
      <PairProfileSideNav pairSlug={pair.slug} profiles={profiles} activeProfileSlug={activeProfile.profile_slug} />

      {/* Fixed (not part of the scrolling content) and lined up with Nav's
          own top-[3%] row — left-[2.6%] matches Nav's left-[2.6%] widgets
          (the bottom-left Log In / profile menu) the same way the back
          link used to, but directly now: this needs to live OUTSIDE the
          w-screen/-translate-x-1/2 wrapper below, since a transformed
          ancestor becomes the containing block for any position:fixed
          descendant — nested inside that wrapper, "fixed" would only
          stick to that wrapper's own (scrolling) box, not the viewport.
          justify-start (not justify-center) so the arrow glyph itself
          sits flush at left-[2.6%] — the profile widget's dot has no
          padding of its own and starts flush there too, so centering the
          icon inside its 32px tap target left it visibly ~7px right of
          the dot despite both containers sharing the same left offset. */}
      <Link
        href="/profile"
        aria-label="Back to Profile"
        className="fixed left-[2.6%] top-[3%] z-[60] inline-flex w-8 h-8 rounded-full items-center justify-start hover:opacity-70 transition-opacity"
        style={{ color: activeProfile.icon_color }}
      >
        <ArrowLeft size={18} />
      </Link>

      {activeProfile.page_type === 'custom_html' ? (
        <>
          <CustomHtmlProfileView htmlContent={customHtmlContent ?? null} title={activeProfile.title} />
          {/* The iframe above is fixed full-viewport with nothing else in
              the page flow, so Edit/Delete have nowhere inline to sit —
              this is the one case that still needs them floating. */}
          {canEdit && (
            <div className="fixed bottom-[3%] right-[2.6%] z-[60] flex gap-2">
              <Link href={`/profile/${pair.slug}/edit`} className="btn-ghost" style={{ color: activeProfile.icon_color, borderColor: `${activeProfile.icon_color}33` }}>Edit</Link>
              <DeleteCharacterPairButton pairId={pair.id} />
            </div>
          )}
        </>
      ) : (
        <>
          {/* Scroll-bounce past the true end of the page reveals whatever's
              behind the document — there's nothing real to put there, and
              trying to color-match a flat stand-in to the gradient above it
              (an earlier attempt) still read as an obvious seam. Disabling
              the bounce itself, only on this page, sidesteps that entirely. */}
          {activeProfile.background_url && <ScrollBounceLock />}

          {/* Full-bleed custom background — renders inside <main>, which already
              paints on top of the shared layout's decorative grid (a sibling
              earlier in the DOM), so this substitutes it with no changes needed
              to layout.tsx. Nav sits above both via its own z-[60]. */}
          {activeProfile.background_url && (
            <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
              {/* object-cover already matches whichever of width/height the
                  viewport constrains (and stays centered, so resizing doesn't
                  visibly shift it) — blur strength is user-selected 1-100%,
                  mapped linearly onto a 0-40px radius; scale-105 hides the
                  softened edge the blur pushes just past the image's bounds. */}
              <img
                src={activeProfile.background_url}
                alt=""
                className="w-full h-full object-cover scale-105"
                style={{ filter: `blur(${(activeProfile.background_blur / 100) * 40}px)` }}
              />
            </div>
          )}

          {/* Breaks out of <main>'s centered max-w-5xl the same way gallery does
              — and unlike gallery, doesn't re-cap with its own max-w either, so
              this fills the full page width when a background is set. flex
              flex-col + min-h-screen (rather than a plain block) is what lets
              the glow wrapper below reach the bottom of the screen on a short
              page with zero JS: see the comment on that wrapper for the full
              reasoning. -mb-16 cancels <main>'s own pb-16 (see (main)/layout.tsx)
              — without it, that trailing 64px of ambient page padding sits
              below this component, outside its box entirely, so the glow
              (which can only ever cover its OWN box) leaves it visibly untinted
              no matter how correctly the glow itself is sized. animate-fade-up
              has to live on the plain (unstyled, still full-width) inner div,
              not this one — its keyframe sets `transform: translateY(...)`,
              which as a plain CSS animation replaces the whole `transform`
              property outright and would silently cancel out this div's own
              -translate-x-1/2. */}
          <div className="relative z-10 w-screen left-1/2 -translate-x-1/2 -mb-16 flex flex-col min-h-screen">
            <div className="animate-fade-up flex flex-col flex-1">
              <div className="px-6 sm:pl-[calc(2.6vw+159px)] pt-4 space-y-8">
                {activeProfile.pair_image_url ? (
                  <CharacterPairHero
                    imageUrl={activeProfile.pair_image_url}
                    title={activeProfile.title}
                    titleFont={activeProfile.title_font}
                    titleColor={activeProfile.title_color}
                    titleSize={activeProfile.title_size}
                    linkText={activeProfile.link_text}
                    linkUrl={activeProfile.link_url}
                    linkFont={activeProfile.link_font}
                    linkColor={activeProfile.link_color}
                    hasMusic={activeProfile.has_music}
                    char1={char1}
                    char2={char2}
                  />
                ) : (
                  <div>
                    <h1 style={{ fontFamily: pairFontFamily(activeProfile.title_font), color: activeProfile.title_color, fontSize: activeProfile.title_size }}>{activeProfile.title}</h1>
                    <PairLink text={activeProfile.link_text} url={activeProfile.link_url} font={activeProfile.link_font} color={activeProfile.link_color} hasMusic={activeProfile.has_music} />
                  </div>
                )}
              </div>

              {activeProfile.pair_image_url ? (
                // The old approach measured the description's on-screen
                // position with JS (a portal into <body> sized via
                // getBoundingClientRect) and re-derived its height on mount,
                // resize, and page-settle timers — but any layout change this
                // didn't anticipate (a section added, a font swap, a slow
                // image load racing the measurement) could leave it undersized,
                // showing bare unblurred backdrop below the text. This wrapper
                // instead lets the browser's own layout engine do the sizing,
                // continuously, for free: flex-1 (grow, but flex-basis:auto —
                // Tailwind's plain `grow`, not `flex-1`, which would zero the
                // basis) makes it at least as tall as its own content (the
                // section grid below), and ALSO grow to fill any remaining
                // space down to min-h-screen's floor on the outer flex column
                // above — i.e. exactly max(content height, viewport bottom),
                // the same rule the JS version was computing by hand, now just
                // native flex layout that recalculates on every reflow. The two
                // characters' gradients are painted directly as THIS element's
                // own `background` (stacked as comma-separated layers) rather
                // than as separate `position:absolute; inset:0` children —
                // deliberately avoiding "an absolutely positioned box sized by
                // a flex-grow ancestor," which some engines have been known to
                // get wrong (the abs-positioned child's size not always tracking
                // the flex item's grown height on every reflow). A `background`
                // has no separate box to get out of sync with — it's painted
                // into this element's own already-correct border box, full stop.
                <div
                  className="grow"
                  style={{
                    background: [char1, char2]
                      .filter(c => (c.description_sections?.length ?? 0) > 0)
                      .map(c => `linear-gradient(to top, ${c.description_color}CC 0%, ${c.description_color}00 90%)`)
                      .join(', ') || undefined,
                  }}
                >
                  <div className="px-6 sm:pl-[calc(2.6vw+159px)] pt-8 pb-4 space-y-8">
                    {/* Each section is sized to 80% of its own grid column
                        (not 80% of the whole row), capped at 650px so it
                        doesn't balloon on very wide columns. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:items-start">
                      {[char1, char2].map((character, i) => (
                        <CharacterDescriptionSections key={character.id} character={character} charIdx={i} />
                      ))}
                    </div>

                    <CharacterPairTimeline profile={activeProfile} char1={char1} char2={char2} />

                    {canEdit && (
                      <div className="flex gap-2 pt-4 border-t border-scroll-300">
                        {/* .btn-ghost's text/border colors are fixed ink values,
                            not currentColor-based, so the override needs both
                            properties set explicitly here rather than just
                            `color`. Delete stays on its own established
                            red/ember styling — that's a deliberate danger
                            signal, not part of this theming. */}
                        <Link href={`/profile/${pair.slug}/edit`} className="btn-ghost" style={{ color: activeProfile.icon_color, borderColor: `${activeProfile.icon_color}33` }}>Edit</Link>
                        <DeleteCharacterPairButton pairId={pair.id} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-6 sm:pl-[calc(2.6vw+159px)] pt-8 pb-4 space-y-8">
                  {/* Each card is sized to 80% of its own grid column (not 80%
                      of the whole row), capped at 650px so it doesn't balloon
                      on very wide columns, and pinned to that column's outer
                      edge via justify-self — column 1 hugs the container's
                      left end, column 2 hugs its right end, leaving the middle
                      open rather than the two cards meeting in the center. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {[char1, char2].map((character, i) => (
                      <div key={character.id} className={`sm:w-4/5 sm:max-w-[650px] ${i === 0 ? 'sm:justify-self-start' : 'sm:justify-self-end'}`}>
                        <CharacterCard character={character} />
                      </div>
                    ))}
                  </div>

                  <CharacterPairTimeline profile={activeProfile} char1={char1} char2={char2} />

                  {canEdit && (
                    <div className="flex gap-2 pt-4 border-t border-scroll-300">
                      <Link href={`/profile/${pair.slug}/edit`} className="btn-ghost" style={{ color: activeProfile.icon_color, borderColor: `${activeProfile.icon_color}33` }}>Edit</Link>
                      <DeleteCharacterPairButton pairId={pair.id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
