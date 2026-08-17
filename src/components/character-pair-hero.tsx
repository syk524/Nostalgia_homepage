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
// arbitrary photo content). Character names stay pinned at the image's
// vertical center, confined to the left/right edges of an 80%-wide centered
// band — measured against the full page content width, not the narrower
// (60vw) image itself, which is why the image sits in its own inner wrapper
// while the overlay is positioned against the outer, full-width one.
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
  return (
    <div className="space-y-4">
      <h1 className="text-center" style={{ fontFamily: pairFontFamily(titleFont), color: titleColor, fontSize: titleSize }}>{title}</h1>

      <div className="relative w-full">
        <div className="w-[60vw] mx-auto">
          <img src={imageUrl} alt="" className="w-full h-auto block rounded" />
        </div>

        <div className="absolute top-0 bottom-0 left-[10%] right-[10%] flex items-center justify-between gap-6 pointer-events-none">
          {char1 && <CharacterCaption character={char1} align="left" />}
          {char2 && <CharacterCaption character={char2} align="right" />}
        </div>
      </div>
    </div>
  )
}
