import Link from 'next/link'
import { Plus } from 'lucide-react'
import { pairFontFamily } from '@/lib/fonts'
import type { CharacterPair, PairProfile, ProfileCharacter } from '@/types/database'

// Everything the grid needs comes from the primary profile — title,
// thumbnail image/background, and both characters' names — since nothing
// is shared at the pair level any more.
type PrimaryProfileSummary = Pick<PairProfile, 'title' | 'title_font' | 'pair_image_url' | 'illustration_source' | 'background_url'> & {
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

const BACKGROUND_HEIGHT = 140

// aspect-[5/2] + a max-height cap, not a flat pixel height — the box (and
// therefore the amount of the pair image's bottom edge that gets cropped)
// now grows along with the column width instead of staying pinned, up to
// MAX_THUMBNAIL_HEIGHT, past which it stops growing so very wide columns
// don't blow the crop area out indefinitely. Below 1020px the grid is a
// single full-width column (this file's own GRID_CLASSES), so aspect-[5/2]
// there made the box — and with it the background photo, which already
// fills the whole box below the desktop breakpoint since BACKGROUND_HEIGHT
// (140px) exceeds a mobile-width box's own height — noticeably tall;
// aspect-[5/1] (half the height, same width) is what was asked for,
// reported directly. min-[1020px]:aspect-[5/2] keeps desktop unchanged.
const THUMBNAIL_ASPECT_CLASSES = 'aspect-[5/1] min-[1020px]:aspect-[5/2] max-h-[320px]'

function PairCard({ pair }: { pair: PairWithPrimaryProfile }) {
  const primaryProfile = pair.pair_profiles[0]
  const [char1, char2] = [...(primaryProfile?.profile_characters ?? [])].sort((a, b) => a.slot - b.slot)

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
            <div
              className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t"
              style={{ height: BACKGROUND_HEIGHT }}
            >
              <img src={primaryProfile.background_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {/* top-[15px] was calibrated against the desktop-height box
              (aspect-[5/2]) — on the much shorter mobile box
              (aspect-[5/1]) that same offset only ever showed the top
              ~15% of the artwork (hair/headroom), not the characters'
              faces, reported directly. min-[1020px]:top-[15px] keeps
              desktop exactly as it was; the mobile-only top-[-64px]
              pushes the image up so the visible window falls lower into
              the artwork instead, roughly where faces tend to sit. */}
          <img
            src={primaryProfile.pair_image_url}
            alt=""
            className="absolute left-1/2 top-[-64px] min-[1020px]:top-[15px] z-10 w-[75%] max-w-[600px] h-auto -translate-x-1/2 transition-transform duration-200 group-hover:-translate-y-[15px]"
          />
          {primaryProfile.illustration_source && (
            // Always this exact font/color/size regardless of what's
            // picked for the detail page — the thumbnail is a fixed,
            // consistent design element, not a per-profile customization
            // surface. Noto Sans KR's light (300) weight, loaded in
            // layout.tsx specifically for this. Was anchored off the box's
            // own bottom (bottom: BACKGROUND_HEIGHT + 6, sitting just
            // above the background band's own top edge) back when the
            // band only covered part of a taller box — now that the band
            // fills the whole box at both this aspect ratio and the
            // mobile one below it, that same math places the credit
            // above the box's own top edge entirely (invisible), reported
            // directly. Anchored from the top instead — top-right of the
            // image, plainly, regardless of box height. */}
            <span
              className="absolute right-1.5 top-1.5 z-20 max-w-[60%] truncate text-[10.8px] pointer-events-none"
              style={{ fontFamily: 'var(--font-noto-sans-kr), sans-serif', fontWeight: 300, color: '#5B574E' }}
            >
              ©{primaryProfile.illustration_source}
            </span>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video rounded flex items-center justify-center text-scroll-400 text-3xl">◯</div>
      )}

      <div className="grid grid-cols-3 items-baseline gap-2 pt-3 text-sm">
        <span style={{ fontFamily: pairFontFamily(char1?.name_font) }}>{char1?.name}</span>
        <span className="font-medium text-center" style={{ fontSize: '1.5em', fontFamily: pairFontFamily(primaryProfile?.title_font) }}>{primaryProfile?.title}</span>
        <span className="text-right" style={{ fontFamily: pairFontFamily(char2?.name_font) }}>{char2?.name}</span>
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
        className={`w-full rounded flex items-center justify-center text-ink-400 transition-colors group-hover:text-ink-600 group-hover:bg-[#5C574D]/20 ${THUMBNAIL_ASPECT_CLASSES}`}
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
