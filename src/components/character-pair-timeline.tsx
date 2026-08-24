import Image from 'next/image'
import { pairFontFamily } from '@/lib/fonts'
import type { PairProfile, ProfileCharacter } from '@/types/database'

// One shared avatar-icon trigger for a character's thought on a given
// entry — the character's own profile picture when they have one set,
// falling back to an initials circle (colored off their existing name
// color/font) when they don't. Hidden entirely when this character has no
// thought text for the entry (nothing to show on hover).
function ThoughtAvatar({ character, thought }: { character: ProfileCharacter; thought: string }) {
  const initial = character.name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="thought-tt-wrap">
      {character.profile_image_url ? (
        <Image
          tabIndex={0}
          src={character.profile_image_url}
          alt={character.name}
          width={28}
          height={28}
          className="thought-tt-trigger w-7 h-7 rounded-full object-cover border cursor-default select-none"
          style={{ borderColor: `${character.name_color}55` }}
        />
      ) : (
        <span
          tabIndex={0}
          className="thought-tt-trigger inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border cursor-default select-none"
          style={{
            color: character.name_color,
            borderColor: `${character.name_color}55`,
            background: `${character.name_color}1a`,
            fontFamily: pairFontFamily(character.name_font),
          }}
          aria-label={`${character.name}’s thought`}
        >
          {initial}
        </span>
      )}
      <span className="thought-tt" role="tooltip">{thought}</span>
    </span>
  )
}

// Dot sits this far below its row's own top, to land on the TITLE's line
// rather than the subtitle above it. It's a fixed pixel amount (not
// measured per entry) rather than a margin on the dot itself — margin would
// leave that span uncolored, breaking the line right above every dot but
// the first (nothing upstream fills a margin). Rendering it as its own
// lead-in segment lets it carry the line color instead, so the previous
// row's trailing segment (which fills down to this row's top) hands off to
// this one with no gap.
const DOT_TOP_OFFSET = 28

// Consolidated pair-level timeline — one shared sequence of entries (not
// per character), each with a subtitle (styled like the hero catchphrase),
// a title, a description, and each character's optional "thought" surfaced
// as a hover-tooltip avatar rather than inline text. Dot + connecting line
// live in their own flex column per row (flex-col, items-center) rather
// than one absolutely-positioned line spanning the whole list — align-
// items:stretch makes that column match each row's own content height for
// free, so consecutive rows' trailing line segments butt into the next
// row's lead-in segment with no manual height math.
export function CharacterPairTimeline({ profile, char1, char2 }: { profile: PairProfile; char1?: ProfileCharacter; char2?: ProfileCharacter }) {
  // A profile always carries at least one entry from the form's own
  // default, but that default has no content until the user fills it in —
  // skip any entry with nothing in it rather than showing an empty dot.
  const entries = (profile.timeline_entries ?? []).filter(e => e.subtitle || e.title || e.description || e.char1_thought || e.char2_thought)
  if (!entries.length) return null

  return (
    <div className="max-w-[650px] mx-auto w-full pt-10">
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1
        return (
          <div key={entry.id} className="flex gap-6">
            <div className="flex flex-col items-center w-3 shrink-0">
              <div
                className="w-px shrink-0"
                style={{
                  height: DOT_TOP_OFFSET,
                  background: i > 0 ? profile.timeline_line_color : 'transparent',
                  boxShadow: i > 0 && profile.timeline_shadow ? `0 0 6px ${profile.timeline_line_color}` : undefined,
                }}
              />
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: profile.timeline_dot_color, boxShadow: profile.timeline_shadow ? `0 0 8px ${profile.timeline_dot_color}` : undefined }}
              />
              {!isLast && (
                <div
                  className="w-px flex-1 mt-1"
                  style={{ background: profile.timeline_line_color, boxShadow: profile.timeline_shadow ? `0 0 6px ${profile.timeline_line_color}` : undefined }}
                />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-8">
              {entry.subtitle && (
                <p style={{ fontFamily: pairFontFamily(profile.timeline_subtitle_font), color: entry.subtitle_color, fontSize: 13, letterSpacing: '0.3em' }}>
                  {entry.subtitle}
                </p>
              )}
              {entry.title && (
                <h4 className="text-lg min-[1020px]:text-xl font-semibold mt-1" style={{ fontFamily: pairFontFamily(profile.timeline_title_font), color: entry.title_color }}>
                  {entry.title}
                </h4>
              )}
              {entry.description && (
                // Matches a description section's own text width: that
                // card is capped at max-w-[650px] with p-6 (3rem) of
                // horizontal padding eating into it, so its rendered text
                // tops out at 650px - 3rem — same cap, expressed directly
                // rather than as a separately-tracked pixel constant.
                <p className="whitespace-pre-wrap leading-relaxed text-sm mt-2 max-w-[calc(650px-3rem)]" style={{ color: profile.timeline_text_color }}>
                  {entry.description}
                </p>
              )}
              {/* No object-cover/max-height cap — reported directly: shown
                  at its own natural aspect ratio, never cropped, so height
                  is whatever the image's own ratio works out to once
                  width is capped to the entry's own text width. */}
              {entry.image_url && (
                <img
                  src={entry.image_url}
                  alt=""
                  className="w-full max-w-[calc(650px-3rem)] rounded mt-3"
                />
              )}
              {(entry.char1_thought || entry.char2_thought) && (
                <div className="flex items-center gap-2 mt-3">
                  {char1 && entry.char1_thought && <ThoughtAvatar character={char1} thought={entry.char1_thought} />}
                  {char2 && entry.char2_thought && <ThoughtAvatar character={char2} thought={entry.char2_thought} />}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
