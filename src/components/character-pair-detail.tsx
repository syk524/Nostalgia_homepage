import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DeleteCharacterPairButton } from '@/app/(main)/profile/[id]/delete-button'
import { CharacterPairHero } from '@/components/character-pair-hero'
import { NavIconColorSetter } from '@/components/nav-icon-color-setter'
import { pairFontFamily } from '@/lib/fonts'
import type { CharacterPair, Character } from '@/types/database'

// Long-form description only — name/catchphrase/quote already live in the
// overlay above the image, so this card would be redundant repeating them.
function CharacterDescription({ character }: { character: Character }) {
  if (!character.description) return null
  return (
    <div className="card p-6">
      <h3 className="text-lg text-ink mb-2">{character.name}</h3>
      <p className="text-ink whitespace-pre-wrap leading-relaxed text-sm">{character.description}</p>
    </div>
  )
}

// Fallback for pairs with no pair image to overlay onto — same
// catchphrase → name → quote → description order, in the app's normal
// ink-on-card colors instead of white-on-photo.
function CharacterCard({ character }: { character: Character }) {
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
      {character.description && (
        <p className="text-ink whitespace-pre-wrap leading-relaxed text-sm pt-2 border-t border-scroll-300">{character.description}</p>
      )}
    </div>
  )
}

export function CharacterPairDetail({ pair, canEdit }: { pair: CharacterPair & { characters: Character[] }; canEdit: boolean }) {
  const sorted = [...pair.characters].sort((a, b) => a.slot - b.slot)
  const [char1, char2] = sorted

  return (
    <div className="relative">
      <NavIconColorSetter color={pair.icon_color} />

      {/* Full-bleed custom background — renders inside <main>, which already
          paints on top of the shared layout's decorative grid (a sibling
          earlier in the DOM), so this substitutes it with no changes needed
          to layout.tsx. Nav sits above both via its own z-[60]. */}
      {pair.background_url && (
        <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
          {/* object-cover already matches whichever of width/height the
              viewport constrains (and stays centered, so resizing doesn't
              visibly shift it) — blur strength is user-selected 1-100%,
              mapped linearly onto a 0-40px radius; scale-105 hides the
              softened edge the blur pushes just past the image's bounds. */}
          <img
            src={pair.background_url}
            alt=""
            className="w-full h-full object-cover scale-105"
            style={{ filter: `blur(${(pair.background_blur / 100) * 40}px)` }}
          />
        </div>
      )}

      {/* Breaks out of <main>'s centered max-w-5xl the same way gallery does
          — and unlike gallery, doesn't re-cap with its own max-w either, so
          this fills the full page width when a background is set. The
          fade-up animation has to live on the INNER div, not this one — its
          keyframe sets `transform: translateY(...)`, which as a plain CSS
          animation replaces the whole `transform` property outright and
          would silently cancel out this div's own -translate-x-1/2. */}
      <div className="relative z-10 w-screen left-1/2 -translate-x-1/2 px-6">
        <div className="animate-fade-up space-y-8 py-4">
          <Link
            href="/profile"
            aria-label="Back to Profile"
            className="inline-flex w-8 h-8 rounded-full items-center justify-center text-ink-500 hover:text-ink transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>

          {pair.pair_image_url ? (
            <CharacterPairHero
              imageUrl={pair.pair_image_url}
              title={pair.title}
              titleFont={pair.title_font}
              titleColor={pair.title_color}
              titleSize={pair.title_size}
              char1={char1}
              char2={char2}
            />
          ) : (
            <h1 style={{ fontFamily: pairFontFamily(pair.title_font), color: pair.title_color, fontSize: pair.title_size }}>{pair.title}</h1>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {sorted.map(character => pair.pair_image_url
              ? <CharacterDescription key={character.id} character={character} />
              : <CharacterCard key={character.id} character={character} />
            )}
          </div>

          {canEdit && (
            <div className="flex gap-2 pt-4 border-t border-scroll-300">
              <Link href={`/profile/${pair.id}/edit`} className="btn-ghost">Edit</Link>
              <DeleteCharacterPairButton pairId={pair.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
