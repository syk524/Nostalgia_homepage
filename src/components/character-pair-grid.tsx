import Link from 'next/link'
import Image from 'next/image'
import { Plus } from 'lucide-react'
import { pairFontFamily, pairFontWeight } from '@/lib/fonts'
import type { CharacterPair, PairProfile, ProfileCharacter } from '@/types/database'

// Everything the grid needs comes from the primary profile — title,
// thumbnail image/background, and both characters' names — since nothing
// is shared at the pair level any more.
type PrimaryProfileSummary = Pick<PairProfile, 'title' | 'title_font' | 'pair_image_url' | 'illustration_source' | 'world' | 'swap_thumbnail_names' | 'background_url'> & {
  profile_characters: Pick<ProfileCharacter, 'name' | 'name_color' | 'name_font' | 'slot'>[]
}
type PairWithPrimaryProfile = CharacterPair & { pair_profiles: PrimaryProfileSummary[] }

// 1 column below 1020px (mobile view, matching the pair detail page's own
// mobile/desktop split), 2 pairs per row from 1020px up — the "list view"
// look this grid had before. min-[1020px] instead of Tailwind's own lg:
// (1024px) to hit the exact value asked for rather than the 4px-off
// default, and used as the single breakpoint here (no separate sm:) so
// there's no in-between range with its own column count.
const GRID_CLASSES = 'grid grid-cols-1 min-[1020px]:grid-cols-2 gap-x-3 gap-y-5'

// aspect-[5/2] + a max-height cap, not a flat pixel height — the box (and
// therefore the amount of the pair image's bottom edge that gets cropped)
// now grows along with the column width instead of staying pinned, up to
// MAX_THUMBNAIL_HEIGHT, past which it stops growing so very wide columns
// don't blow the crop area out indefinitely. Was aspect-[5/1] on mobile
// (half this height) for a few turns, then explicitly asked back up to
// 2x that — i.e. exactly this ratio again — so mobile and desktop now
// share one value; the background band inside stays at its own separate,
// smaller mobile height regardless (see that div's own comment) since
// this request was about the container, not the band.
const THUMBNAIL_ASPECT_CLASSES = 'aspect-[5/2] max-h-[320px]'

function PairCard({ pair }: { pair: PairWithPrimaryProfile }) {
  const primaryProfile = pair.pair_profiles[0]
  const [char1, char2] = [...(primaryProfile?.profile_characters ?? [])].sort((a, b) => a.slot - b.slot)
  // Thumbnail-only — the detail page's own caption layout
  // (character-pair-hero.tsx) always follows char1/char2 slot order
  // regardless of this, per direct request.
  const [leftChar, rightChar] = primaryProfile?.swap_thumbnail_names ? [char2, char1] : [char1, char2]

  return (
    <Link href={`/profile/${pair.slug}`} className="group block">
      {primaryProfile?.pair_image_url ? (
        // Box sized off the column width (via aspect ratio), not off the
        // pair image's own height — the pair image is absolutely
        // positioned inside it, so anything past the box's bottom edge
        // (typically its legs/feet) is cropped by overflow-hidden instead
        // of growing the card to fit. That's also what "brings the
        // background up": since the background band stays bottom-anchored
        // to this box instead of the image's full height, it ends up
        // sitting higher up the artwork.
        <div className={`relative w-full overflow-hidden rounded ${THUMBNAIL_ASPECT_CLASSES}`}>
          {primaryProfile.background_url && (
            // Four tiers now: h-10 (40px) up to 370px; min-[371px]:h-[95px]
            // from 371px up to (not including) 520px — a dedicated
            // narrow-phone tier, 40px less than the 135px tier beside it,
            // reported directly; min-[520px]:h-[135px] from 520px up to
            // (not including) 1020px, unchanged from before (this tier
            // itself climbed in successive 1.5x steps across several
            // earlier requests: 40 → 60 → 90 → 135); min-[1020px]:h-140
            // (unchanged, desktop) from there. Layered on top of the
            // earlier "grow the container without touching this band"
            // request (see that comment's own history a few commits back)
            // rather than replacing it outright.
            <div
              className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t h-10 min-[371px]:h-[95px] min-[520px]:h-[135px] min-[1020px]:h-[140px]"
            >
              <Image
                src={primaryProfile.background_url}
                alt=""
                fill
                sizes="(min-width: 1020px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          )}
          {/* Stays a plain <img>, not next/image — its height is `auto`,
              driven by the image's own natural aspect ratio (cropped by
              the parent box below it, not stretched to fill one), and
              nothing here stores that ratio ahead of render the way
              next/image's required width/height (or a fill parent with a
              known aspect) would need. */}
          <img
            src={primaryProfile.pair_image_url}
            alt=""
            className="absolute left-1/2 top-[15px] z-10 w-[75%] max-w-[600px] h-auto -translate-x-1/2 transition-transform duration-200 group-hover:-translate-y-[15px]"
          />
          {primaryProfile.world && (
            // Centered near the box's own bottom edge, overlaid directly
            // on the art — a deliberate reveal now, not a permanently
            // visible label, so it only needs to read clearly for the
            // moment it's shown, reported directly. tracking-normal +
            // opacity-0 at rest, both animating together on hover: the
            // reveal is "fade in while tracking out," not just a fade —
            // 0.4em matches this session's own "(N-1)em added to the
            // resting 0 tracking" convention for an asked-for "Nx"
            // tracking (character-pair-hero.tsx's catchphrase is the one
            // exception, using its own em value directly rather than a
            // delta, since that's a big display quote and this is a small
            // label like the char-name hover effect below). The ! is
            // load-bearing on the tracking override, same specificity gap
            // as that same char-name hover two blocks down. Overlaid
            // directly on the art brings back the exact legibility problem
            // solved once already this feature (the credit's own
            // low-contrast color goes fully invisible against dark/busy
            // art) — confirmed again live (computed opacity/letter-spacing
            // both correct on hover, just unreadable), so a halo comes
            // back too, this time load-bearing rather than optional, since
            // a reveal nobody can read doesn't do its job. Both the text
            // color and the halo are pinned to the noir combo (#f1f1f1
            // text, #010101 halo) always, on every theme including
            // Sticker/default, per direct request — the credit's own
            // gray (#5B574E, below) is untouched, this is scoped to the
            // world tag only.
            <span
              className="absolute inset-x-0 bottom-4 z-20 text-center truncate px-4 text-[12.96px] pointer-events-none noir-accent-color tracking-normal opacity-0 group-hover:!tracking-[0.4em] group-hover:opacity-100 transition-[letter-spacing,opacity] duration-200"
              style={{
                fontFamily: pairFontFamily('serifBold'), color: '#f1f1f1',
                // Both scaled 1.2x alongside the font size (10.8px→12.96px,
                // 2/2/3/4/4px→2.4/2.4/3.6/4.8/4.8px) so the halo keeps the
                // same proportion to the letterforms rather than getting
                // comparatively thinner as the text grows, per direct
                // request.
                textShadow: '0 0 2.4px #010101, 0 0 2.4px #010101, 0 0 3.6px #010101, 0 0 4.8px #010101, 0 0 4.8px #010101',
              }}
            >
              {primaryProfile.world}
            </span>
          )}
          {primaryProfile.illustration_source && (
            // Always this exact font/color/size regardless of what's
            // picked for the detail page — the thumbnail is a fixed,
            // consistent design element, not a per-profile customization
            // surface. Noto Sans KR's light (300) weight, loaded in
            // layout.tsx specifically for this. Anchored off the box's own
            // bottom, sitting a fixed 6px above the background band's own
            // top edge, mirroring that div's own four-tier height:
            // bottom-[46px] up to 370px (band's h-10 + 6), bottom-[101px]
            // from 371px up to 520px (band's 95px + 6), bottom-[141px]
            // from 520px up to 1020px (band's 135px + 6), bottom-[146px]
            // from 1020px up (band's 140px + 6). Was briefly anchored from
            // the top instead, back when the band filled the whole box on
            // mobile and this same above-the-band math would've landed
            // above the box's own top edge entirely (invisible) — now
            // that the band leaves headroom again at every width, this
            // sits directly above the background image itself again, not
            // just floating near the top of the whole (now much taller)
            // container, reported directly. */}
            <span
              className="absolute right-1.5 bottom-[46px] min-[371px]:bottom-[101px] min-[520px]:bottom-[141px] min-[1020px]:bottom-[146px] z-20 max-w-[60%] truncate text-[10.8px] pointer-events-none noir-accent-color"
              style={{ fontFamily: 'var(--font-noto-sans-kr), sans-serif', fontWeight: 300, color: '#5B574E' }}
            >
              ©{primaryProfile.illustration_source}
            </span>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video rounded flex items-center justify-center text-scroll-400 text-3xl">◯</div>
      )}

      {/* tracking-[0.1em] on hover, not a literal "1.1x" of the resting
          tracking-normal (0 — multiplying that by anything is still 0) —
          same "letter-spacing as a percent of font-size" convention
          character-pair-hero.tsx's own catchphrase already uses (that
          one's 1.4em, "140% tracking"), so 0.1em here reads as the
          asked-for 1.1x on the same scale. Character names only, not
          the pair title in the middle, reported directly. The ! is
          load-bearing: .group:hover .group-hover\:tracking-[0.1em]'s
          own specificity (0,3,0) should already beat plain
          .tracking-normal's (0,1,0) on paper, but it didn't win in
          testing — confirmed via injected !important instead of chasing
          why (the same "don't trust specificity math alone against
          Tailwind's generated output" lesson as the sticker z-index/
          shrink-to-fit issues earlier this session, just once more). */}
      <div className="grid grid-cols-3 items-baseline gap-2 pt-3 text-sm">
        <span className="tracking-normal group-hover:!tracking-[0.1em] transition-[letter-spacing] duration-200" style={{ fontFamily: pairFontFamily(leftChar?.name_font), fontWeight: pairFontWeight(leftChar?.name_font), color: 'var(--theme-accent)' }}>{leftChar?.name}</span>
        <span className="font-medium text-center" style={{ fontSize: '1.5em', fontFamily: pairFontFamily(primaryProfile?.title_font), fontWeight: pairFontWeight(primaryProfile?.title_font), color: 'var(--theme-accent)' }}>{primaryProfile?.title}</span>
        <span className="text-right tracking-normal group-hover:!tracking-[0.1em] transition-[letter-spacing] duration-200" style={{ fontFamily: pairFontFamily(rightChar?.name_font), fontWeight: pairFontWeight(rightChar?.name_font), color: 'var(--theme-accent)' }}>{rightChar?.name}</span>
      </div>
    </Link>
  )
}

// Same centered-plus-icon tile used for "add a sticker" (see
// sticker-gallery-modal.tsx for the pattern this is based on, though
// that one keeps a dashed border at rest) — kept here as a grid tile
// instead of a btn-primary above the grid so it reads as "one more
// card you can add" rather than a page-level action. Matches PairCard's
// own image-box height, but no caption row below it — the plus icon
// alone is the label, and a real card's caption row would leave a
// misleading blank title/author-name space here since this tile has
// none of that yet. Quiet at rest (no border, no fill) and only reveals
// itself as a tile via a background tint on hover.
// self-end: on an odd-count grid, this tile shares its row with a
// single real card whose image is followed by a caption line, making
// the row taller than this tile's own natural (image-only) height.
// Without self-end, CSS Grid's default align-items:stretch expands
// this anchor to that full row height, and the box's explicit height
// keeps it pinned to the top of that taller box — self-end keeps the
// anchor at its own natural height and pins it to the row's bottom
// edge instead, flush with its row-mate's caption line below.
function AddPairCard() {
  return (
    <Link href="/profile/new" className="group block self-end">
      <div
        className={`w-full rounded flex items-center justify-center text-ink-400 transition-colors group-hover:text-ink-600 group-hover:bg-[#2F2F2E]/20 noir-group-hover noir-icon-hover-accent ${THUMBNAIL_ASPECT_CLASSES}`}
      >
        <Plus size={28} />
      </div>
    </Link>
  )
}

export function CharacterPairGrid({ pairs, canEdit }: { pairs: PairWithPrimaryProfile[]; canEdit: boolean }) {
  return (
    <div className={GRID_CLASSES}>
      {pairs.map(pair => <PairCard key={pair.id} pair={pair} />)}
      {canEdit && <AddPairCard />}
    </div>
  )
}
