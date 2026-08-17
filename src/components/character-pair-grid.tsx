import Link from 'next/link'
import { pairFontFamily } from '@/lib/fonts'
import type { CharacterPair, Character } from '@/types/database'

type PairWithCharacters = CharacterPair & { characters: Character[] }

// 2-up at rest, dropping to 1 column on narrow screens.
const GRID_CLASSES = 'grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-5'

const BACKGROUND_HEIGHT = 140

// Fixed height (not an aspect ratio) so every card's image area stays this
// tall regardless of the card's own width — previously this was aspect-[5/2],
// which meant the crop got shorter/taller as the grid column width changed.
const THUMBNAIL_HEIGHT = 238

function PairCard({ pair }: { pair: PairWithCharacters }) {
  const sorted = [...pair.characters].sort((a, b) => a.slot - b.slot)
  const [char1, char2] = sorted

  return (
    <Link href={`/profile/${pair.id}`} className="group block">
      {pair.pair_image_url ? (
        // Fixed-height box, not sized off the pair image's own height — the
        // pair image is absolutely positioned inside it, so anything past
        // the box's bottom edge (typically its legs/feet) is cropped by
        // overflow-hidden instead of growing the card to fit. That's also
        // what "brings the background up": since the background band stays
        // bottom-anchored to this fixed-height box instead of the image's
        // full height, it ends up sitting higher up the artwork.
        <div className="relative w-full overflow-hidden rounded" style={{ height: THUMBNAIL_HEIGHT }}>
          {pair.background_url && (
            <div
              className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t"
              style={{ height: BACKGROUND_HEIGHT }}
            >
              <img src={pair.background_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <img
            src={pair.pair_image_url}
            alt=""
            className="absolute left-1/2 top-[15px] z-10 w-[75%] max-w-[600px] h-auto -translate-x-1/2 transition-transform duration-200 group-hover:-translate-y-[15px]"
          />
        </div>
      ) : (
        <div className="w-full aspect-video rounded flex items-center justify-center text-scroll-400 text-3xl">◯</div>
      )}

      <div className="grid grid-cols-3 items-baseline gap-2 pt-3 text-sm">
        <span style={{ fontFamily: pairFontFamily(char1?.name_font) }}>{char1?.name}</span>
        <span className="font-medium text-center" style={{ fontSize: '1.5em', fontFamily: pairFontFamily(pair.title_font) }}>{pair.title}</span>
        <span className="text-right" style={{ fontFamily: pairFontFamily(char2?.name_font) }}>{char2?.name}</span>
      </div>
    </Link>
  )
}

export function CharacterPairGrid({ pairs }: { pairs: PairWithCharacters[] }) {
  return (
    <div className={GRID_CLASSES}>
      {pairs.map(pair => <PairCard key={pair.id} pair={pair} />)}
    </div>
  )
}
