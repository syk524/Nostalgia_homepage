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

// 2-up at rest, dropping to 1 column on narrow screens.
const GRID_CLASSES = 'grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-5'

const BACKGROUND_HEIGHT = 140

// Fixed height (not an aspect ratio) so every card's image area stays this
// tall regardless of the card's own width — previously this was aspect-[5/2],
// which meant the crop got shorter/taller as the grid column width changed.
const THUMBNAIL_HEIGHT = 238

function PairCard({ pair }: { pair: PairWithPrimaryProfile }) {
  const primaryProfile = pair.pair_profiles[0]
  const [char1, char2] = [...(primaryProfile?.profile_characters ?? [])].sort((a, b) => a.slot - b.slot)

  return (
    <Link href={`/profile/${pair.slug}`} className="group block">
      {primaryProfile?.pair_image_url ? (
        // Fixed-height box, not sized off the pair image's own height — the
        // pair image is absolutely positioned inside it, so anything past
        // the box's bottom edge (typically its legs/feet) is cropped by
        // overflow-hidden instead of growing the card to fit. That's also
        // what "brings the background up": since the background band stays
        // bottom-anchored to this fixed-height box instead of the image's
        // full height, it ends up sitting higher up the artwork.
        <div className="relative w-full overflow-hidden rounded" style={{ height: THUMBNAIL_HEIGHT }}>
          {primaryProfile.background_url && (
            <div
              className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t"
              style={{ height: BACKGROUND_HEIGHT }}
            >
              <img src={primaryProfile.background_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <img
            src={primaryProfile.pair_image_url}
            alt=""
            className="absolute left-1/2 top-[15px] z-10 w-[75%] max-w-[600px] h-auto -translate-x-1/2 transition-transform duration-200 group-hover:-translate-y-[15px]"
          />
          {primaryProfile.illustration_source && (
            // Always this exact font/color/size regardless of what's
            // picked for the detail page — the thumbnail is a fixed,
            // consistent design element, not a per-profile customization
            // surface. Noto Sans KR's light (300) weight, loaded in
            // layout.tsx specifically for this. Anchored off the box's
            // own bottom (not top) so it sits a fixed 6px above the
            // background band's own top edge regardless of the box's
            // total height — BACKGROUND_HEIGHT (the band's height) + 6.
            <span
              className="absolute right-0 z-20 max-w-[60%] truncate text-[10.8px] pointer-events-none"
              style={{ bottom: BACKGROUND_HEIGHT + 6, fontFamily: 'var(--font-noto-sans-kr), sans-serif', fontWeight: 300, color: '#5B574E' }}
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

// Same dashed-border, centered-plus-icon tile used for "add a sticker"
// (sticker-gallery-modal.tsx) — kept here as a grid tile instead of a
// btn-primary above the grid so it reads as "one more card you can add"
// rather than a page-level action. Matches PairCard's own image-box
// height, but no caption row below it — the plus icon alone is the
// label, and a real card's caption row would leave a misleading blank
// title/author-name space here since this tile has none of that yet.
function AddPairCard() {
  return (
    <Link href="/profile/new" className="group block">
      <div
        className="w-full rounded border-2 border-dashed border-scroll-300 flex items-center justify-center text-ink-400 transition-colors group-hover:text-ink-600 group-hover:border-ink-400"
        style={{ height: THUMBNAIL_HEIGHT }}
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
