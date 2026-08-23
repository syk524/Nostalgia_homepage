import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import { DeleteCharacterPairButton } from '@/app/(main)/profile/[slug]/delete-button'
import { CharacterPairHero } from '@/components/character-pair-hero'
import { CharacterPairTimeline } from '@/components/character-pair-timeline'
import { CustomHtmlProfileView } from '@/components/custom-html-profile-view'
import { PairDescriptionView } from '@/components/pair-description-editor'
import { NavIconColorSetter } from '@/components/nav-icon-color-setter'
import { PairProfileSideNav } from '@/components/pair-profile-side-nav'
import { ScrollBounceLock } from '@/components/scroll-bounce-lock'
import { pairFontFamily } from '@/lib/fonts'
import type { CharacterPair, PairProfile, ProfileCharacter } from '@/types/database'

// Same wordmark asset the homepage itself uses (draggable-home-scene.tsx)
// — stands in for a pair's own image when one hasn't been set, reported
// directly, so every profile always has *some* hero image to anchor the
// photo-overlay layout and caption placement to instead of the old
// separate plain-text/no-image branch.
const PAIR_IMAGE_PLACEHOLDER = '/images/nostalgio-wordmark.webp'

// age/height/weight/job, in that order, "•"-separated with 8px (px-2) of
// horizontal breathing room around each bullet — reported directly.
// Age/height/weight each get their unit ('세'/cm/kg) appended here at
// render time rather than stored on the value, so the editor's own input
// just holds the number.
function characterStats(character: ProfileCharacter): string[] {
  return [
    character.age?.trim() ? `${character.age.trim()}세` : null,
    character.height?.trim() ? `${character.height.trim()}cm` : null,
    character.weight?.trim() ? `${character.weight.trim()}kg` : null,
    character.job?.trim() || null,
  ].filter((s): s is string => !!s)
}

function CharacterStatsLine({ character }: { character: ProfileCharacter }) {
  const stats = characterStats(character)
  if (!stats.length) return null
  return (
    <p className="text-sm" style={{ color: character.stats_color, fontFamily: pairFontFamily(character.stats_font) }}>
      {stats.map((stat, i) => (
        <span key={i}>
          {i > 0 && <span className="px-2" aria-hidden="true">•</span>}
          {stat}
        </span>
      ))}
    </p>
  )
}

// One cell per description section, plus one more (row 1) for the
// character's own name + age/height/weight/job line — name/catchphrase/
// quote already live in the overlay above the image, but the name gets
// re-shown here anyway, reported directly, so the stats line has
// something to sit under. No border (this sits directly on the pair's own
// blurred background image, where a boxed outline reads as clutter). Each
// cell is its own direct grid item (not nested inside a per-character
// wrapper) so it can be explicitly placed via --section-row/--section-col
// — see the ".description-section-cell" rule in globals.css. Placing both
// characters' row N in the same grid row is what makes them top-align,
// and it's what "reserves empty space" for free: if one character has
// fewer sections, the shorter column's rows just have nothing in them,
// they're never explicitly padded to match, but nothing downstream needs
// that either since these sections are the last thing in the row-aligned
// area. The background glow itself is NOT rendered here any more — see
// the glow wrapper in CharacterPairDetail below for why.
function CharacterDescriptionSections({ character, charIdx }: { character: ProfileCharacter; charIdx: number }) {
  const sections = character.description_sections ?? []
  // 1020px, not Tailwind's default sm: (640px) — this page's own
  // breakpoint (reported directly), matching the hero's caption dots and
  // the side-nav's own min-[1020px]:flex above it.
  const alignClass = charIdx === 0 ? 'min-[1020px]:justify-self-start' : 'min-[1020px]:justify-self-end'
  return (
    <>
      {/* No left padding — reported directly: this whole column sits
          inside the same px-6 min-[1020px]:pl-[...] wrapper the hero's own
          catchphrase/name/quote use above it with no padding of their
          own, so this cell's own p-6/px-6 was adding a second, redundant
          24px indent on top of that, throwing this column out of
          alignment with the hero content directly above it. No bottom
          padding either — the grid's own gap-6 between rows is already
          enough separation under a single line of stats, reported
          separately. Gated on sections.length — reported directly: with
          no description sections below it, this was showing as a lone
          name (and maybe stats) heading a description column with
          nothing under it. This is specifically the name re-shown down
          here for the stats line to sit under (see this function's own
          top comment) — the hero's own catchphrase/name/quote overlay
          above the image is untouched by this and always shows
          regardless. */}
      {sections.length > 0 && (
        <div
          className={`description-section-cell rounded pr-6 pt-6 min-[1020px]:w-4/5 min-[1020px]:max-w-[650px] ${alignClass}`}
          style={{ '--section-row': 1, '--section-col': charIdx + 1 } as CSSProperties}
        >
          <h3 className="text-xl min-[1020px]:text-2xl mb-1" style={{ color: character.name_color, fontFamily: pairFontFamily(character.name_font) }}>{character.name}</h3>
          <CharacterStatsLine character={character} />
        </div>
      )}
      {sections.map((section, sectionIdx) => (
        <div
          key={section.id}
          className={`description-section-cell rounded pr-6 pt-6 pb-6 min-[1020px]:w-4/5 min-[1020px]:max-w-[650px] ${alignClass}`}
          style={{ '--section-row': sectionIdx + 2, '--section-col': charIdx + 1 } as CSSProperties}
        >
          {section.title && <h3 className="text-xl min-[1020px]:text-2xl mb-2" style={{ color: section.title_color, fontFamily: pairFontFamily(section.title_font) }}>{section.title}</h3>}
          <PairDescriptionView content={section.description} className="text-sm" style={{ color: section.text_color }} />
        </div>
      ))}
    </>
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
  const pairImageUrl = activeProfile.pair_image_url || PAIR_IMAGE_PLACEHOLDER

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
              {/* -mt-8 (mobile only) pulls the hero up against the shared
                  layout's own pt-24 (main's top padding, sized for
                  desktop's own nav row) — reported directly, that fixed
                  96px plus this div's own pt-4 left a lot of empty space
                  above the title on a narrow phone screen where the nav is
                  just the back arrow and a small MENU toggle, not the full
                  desktop link row that padding was calibrated against.
                  min-[1020px]:mt-0 keeps desktop exactly as it was. px-4
                  (mobile)/min-[1020px]:pr-6 (desktop right edge,
                  unchanged) — written as two separate side-specific
                  classes rather than px-6 plus an overriding pl, so the
                  desktop-only pl-[calc(2.6vw+159px)] below is never
                  fighting another same-breakpoint class over the same
                  property. */}
              <div className="px-4 min-[1020px]:pr-6 min-[1020px]:pl-[calc(2.6vw+159px)] -mt-8 min-[1020px]:mt-0 pt-4 space-y-8">
                <CharacterPairHero
                  imageUrl={pairImageUrl}
                  // Only credit a real illustrator for a real uploaded
                  // image — showing "©[someone]" under the placeholder
                  // wordmark would be attributing art that isn't theirs.
                  illustrationSource={activeProfile.pair_image_url ? activeProfile.illustration_source : null}
                  illustrationSourceFont={activeProfile.illustration_source_font}
                  illustrationSourceColor={activeProfile.illustration_source_color}
                  title={activeProfile.title}
                  titleFont={activeProfile.title_font}
                  titleColor={activeProfile.title_color}
                  titleSize={activeProfile.title_size}
                  linkText={activeProfile.link_text}
                  linkUrl={activeProfile.link_url}
                  linkFont={activeProfile.link_font}
                  linkColor={activeProfile.link_color}
                  hasMusic={activeProfile.has_music}
                  // Only overlaid on a real pair photo — reported directly:
                  // the caption-pinning below is built around a tall
                  // portrait image, and the placeholder wordmark is short/
                  // wide, so captions would float disconnected above it
                  // rather than sit naturally over it.
                  char1={activeProfile.pair_image_url ? char1 : undefined}
                  char2={activeProfile.pair_image_url ? char2 : undefined}
                />
              </div>

              {/* The old approach measured the description's on-screen
                  position with JS (a portal into <body> sized via
                  getBoundingClientRect) and re-derived its height on mount,
                  resize, and page-settle timers — but any layout change this
                  didn't anticipate (a section added, a font swap, a slow
                  image load racing the measurement) could leave it undersized,
                  showing bare unblurred backdrop below the text. This wrapper
                  instead lets the browser's own layout engine do the sizing,
                  continuously, for free: flex-1 (grow, but flex-basis:auto —
                  Tailwind's plain `grow`, not `flex-1`, which would zero the
                  basis) makes it at least as tall as its own content (the
                  section grid below), and ALSO grow to fill any remaining
                  space down to min-h-screen's floor on the outer flex column
                  above — i.e. exactly max(content height, viewport bottom),
                  the same rule the JS version was computing by hand, now just
                  native flex layout that recalculates on every reflow. The two
                  characters' gradients are painted directly as THIS element's
                  own `background` (stacked as comma-separated layers) rather
                  than as separate `position:absolute; inset:0` children —
                  deliberately avoiding "an absolutely positioned box sized by
                  a flex-grow ancestor," which some engines have been known to
                  get wrong (the abs-positioned child's size not always tracking
                  the flex item's grown height on every reflow). A `background`
                  has no separate box to get out of sync with — it's painted
                  into this element's own already-correct border box, full
                  stop. Unconditional now — every profile always has *some*
                  pair image (real or the placeholder wordmark), so there's
                  no separate no-image layout to branch to any more. */}
              <div
                  className="grow"
                  style={{
                    // `to top` — 0% is the box's own bottom edge, 100% is
                    // its top. Was a straight two-stop fade (full CC/~80%
                    // strength right at 0%, sheer 00 by 90%), which read
                    // as the color only ever reaching real strength in a
                    // thin band hugging the very bottom, reported
                    // directly. FF (full 100%, not CC) now holds flat
                    // from 0% up through 85% (raised again from an
                    // initial 45%, both reported directly) — full color
                    // for nearly the entire height, fading out only over
                    // the last narrow stretch up to 90%, still leaving the
                    // top 10% clear.
                    background: [char1, char2]
                      .filter(c => (c.description_sections?.length ?? 0) > 0)
                      .map(c => `linear-gradient(to top, ${c.description_color}FF 0%, ${c.description_color}FF 85%, ${c.description_color}00 90%)`)
                      .join(', ') || undefined,
                  }}
                >
                  {/* px-4 (mobile)/min-[1020px]:pr-6 (desktop right edge,
                      unchanged) — same reasoning as the hero wrapper
                      above: two separate side-specific classes instead of
                      px-6 plus an overriding pl, so the desktop-only
                      pl-[calc(2.6vw+159px)] here is never fighting
                      another same-breakpoint class over the same
                      property. */}
                  <div className="px-4 min-[1020px]:pr-6 min-[1020px]:pl-[calc(2.6vw+159px)] pt-8 pb-4 space-y-8">
                    {/* Each section is sized to 80% of its own grid column
                        (not 80% of the whole row), capped at 650px so it
                        doesn't balloon on very wide columns. */}
                    <div className="grid grid-cols-1 min-[1020px]:grid-cols-2 gap-6 min-[1020px]:items-start">
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
            </div>
          </div>
        </>
      )}
    </div>
  )
}
