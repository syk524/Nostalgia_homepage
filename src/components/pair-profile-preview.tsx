'use client'
import { pairFontFamily } from '@/lib/fonts'
import { PairLink } from '@/components/pair-link'
import { PairDescriptionView } from '@/components/pair-description-editor'

// Mirrors character-pair-hero.tsx / character-pair-detail.tsx /
// character-pair-timeline.tsx closely enough to preview color/font/layout
// choices live, but is deliberately its own rendering rather than a reuse
// of those components: the real page assumes it owns the full viewport
// (position:fixed background/back-button/side-nav) and leans on next/image
// (which errors on the blob: preview URLs a not-yet-uploaded file produces
// here) — neither fits a boxed, embedded editor pane showing in-progress
// edits. Takes the editor's own draft shapes directly (no DB round-trip
// needed to see a change), so it updates on every keystroke.

const PAIR_IMAGE_PLACEHOLDER = '/images/nostalgio-wordmark.webp'

type PreviewSection = { id: string; title: string; titleColor: string; titleFont: string; description: string; textColor: string }
type PreviewChar = {
  name: string; nameColor: string; nameFont: string; nameUnderlineColor: string
  profileImagePreview: string
  catchphrase: string; catchphraseColor: string; catchphraseFont: string
  quote: string; quoteColor: string; quoteFont: string
  keyword1: string; keyword2: string; keyword3: string; keywordFont: string; keywordColor: string
  descriptionColor: string
  captionShadowColor: string; captionShadowStrength: number
  captionOffsetY: number
  age: string; height: string; weight: string; job: string; statsColor: string; statsFont: string
  sections: PreviewSection[]
}
type PreviewTimelineEntry = {
  id: string; subtitle: string; subtitleColor: string; title: string; titleColor: string; description: string
  char1Thought: string; char2Thought: string; imagePreview: string
}
type PreviewProfile = {
  title: string; titleFont: string; titleColor: string; titleSize: number
  linkText: string; linkUrl: string; linkFont: string; linkColor: string; hasMusic: boolean
  pairImagePreview: string
  illustrationSource: string; illustrationSourceFont: string; illustrationSourceColor: string
  backgroundPreview: string; backgroundBlur: number
  timelineSubtitleFont: string; timelineTitleFont: string; timelineTextColor: string
  timelineDotColor: string; timelineLineColor: string; timelineShadow: boolean
  timelineEntries: PreviewTimelineEntry[]
  characters: [PreviewChar, PreviewChar]
}

function statsLine(c: PreviewChar): string[] {
  return [
    c.age.trim() ? `${c.age.trim()}세` : null,
    c.height.trim() ? `${c.height.trim()}cm` : null,
    c.weight.trim() ? `${c.weight.trim()}kg` : null,
    c.job.trim() || null,
  ].filter((s): s is string => !!s)
}

function CaptionBlock({ character, align }: { character: PreviewChar; align: 'left' | 'right' }) {
  const textShadow = `0 0 ${character.captionShadowStrength}px ${character.captionShadowColor}`
  const hasContent = character.name || character.catchphrase || character.quote || character.keyword1 || character.keyword2 || character.keyword3
  if (!hasContent) return <div />
  return (
    <div
      className={`max-w-[45%] min-w-0 ${align === 'right' ? 'text-right ml-auto' : 'text-left'}`}
      style={{ transform: `translateY(${character.captionOffsetY}px)` }}
    >
      {character.catchphrase && (
        <p style={{ fontFamily: pairFontFamily(character.catchphraseFont), color: character.catchphraseColor, fontSize: 9, letterSpacing: '0.3em', textShadow }} className="truncate">
          {character.catchphrase}
        </p>
      )}
      {character.name && (
        <h3 className="text-base leading-tight truncate" style={{ fontFamily: pairFontFamily(character.nameFont), color: character.nameColor, textShadow }}>
          {character.name}
        </h3>
      )}
      <div className={`h-px max-w-[100px] my-1 ${align === 'right' ? 'ml-auto' : ''}`} style={{ background: character.nameUnderlineColor }} />
      {character.quote && (
        <p className="text-sm truncate" style={{ fontFamily: pairFontFamily(character.quoteFont), color: character.quoteColor, textShadow }}>
          “{character.quote}”
        </p>
      )}
      {(character.keyword1 || character.keyword2 || character.keyword3) && (
        <div className={`flex flex-wrap gap-1.5 text-[10px] mt-0.5 ${align === 'right' ? 'justify-end' : ''}`} style={{ fontFamily: pairFontFamily(character.keywordFont), color: character.keywordColor, textShadow }}>
          {[character.keyword1, character.keyword2, character.keyword3].filter(Boolean).map((k, i) => <span key={i}>#{k}</span>)}
        </div>
      )}
    </div>
  )
}

function DescriptionColumn({ character, align }: { character: PreviewChar; align: 'left' | 'right' }) {
  const stats = statsLine(character)
  if (!character.sections.length) return null
  return (
    <div className={align === 'right' ? 'min-[700px]:justify-self-end' : 'min-[700px]:justify-self-start'} style={{ background: `${character.descriptionColor}22` }}>
      <div className="rounded p-3 space-y-3 min-[700px]:max-w-[300px]">
        <div>
          <h4 className="text-sm" style={{ color: character.nameColor, fontFamily: pairFontFamily(character.nameFont) }}>{character.name || '이름 없음'}</h4>
          {stats.length > 0 && (
            <p className="text-[11px]" style={{ color: character.statsColor, fontFamily: pairFontFamily(character.statsFont) }}>
              {stats.join(' • ')}
            </p>
          )}
        </div>
        {character.sections.map(s => (
          <div key={s.id}>
            {s.title && <h5 className="text-xs mb-0.5" style={{ color: s.titleColor, fontFamily: pairFontFamily(s.titleFont) }}>{s.title}</h5>}
            <PairDescriptionView content={s.description} className="text-[11px] leading-snug" style={{ color: s.textColor }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelinePreview({ profile }: { profile: PreviewProfile }) {
  const entries = profile.timelineEntries.filter(e => e.subtitle || e.title || e.description || e.char1Thought || e.char2Thought)
  if (!entries.length) return null
  return (
    <div className="space-y-4">
      {entries.map(entry => (
        <div key={entry.id} className="flex gap-3">
          <div className="flex flex-col items-center w-2 shrink-0 pt-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: profile.timelineDotColor, boxShadow: profile.timelineShadow ? `0 0 6px ${profile.timelineDotColor}` : undefined }} />
            <div className="w-px flex-1 mt-1" style={{ background: profile.timelineLineColor }} />
          </div>
          <div className="flex-1 min-w-0 pb-1 space-y-1">
            {entry.subtitle && <p className="text-[10px] tracking-wide" style={{ fontFamily: pairFontFamily(profile.timelineSubtitleFont), color: entry.subtitleColor }}>{entry.subtitle}</p>}
            {entry.title && <h4 className="text-sm font-semibold" style={{ fontFamily: pairFontFamily(profile.timelineTitleFont), color: entry.titleColor }}>{entry.title}</h4>}
            {entry.description && <p className="whitespace-pre-wrap text-[11px] leading-snug" style={{ color: profile.timelineTextColor }}>{entry.description}</p>}
            {entry.imagePreview && <img src={entry.imagePreview} alt="" className="w-full max-w-[220px] rounded mt-1" />}
            {(entry.char1Thought || entry.char2Thought) && (
              <div className="text-[10px] text-ink-400 space-y-0.5 pt-0.5">
                {entry.char1Thought && <p className="truncate">💭 {profile.characters[0].name || '캐릭터 1'}: {entry.char1Thought}</p>}
                {entry.char2Thought && <p className="truncate">💭 {profile.characters[1].name || '캐릭터 2'}: {entry.char2Thought}</p>}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PairProfilePreview({ profile }: { profile: PreviewProfile }) {
  const [char1, char2] = profile.characters
  const pairImage = profile.pairImagePreview || PAIR_IMAGE_PLACEHOLDER
  const showCaptions = !!profile.pairImagePreview

  return (
    <div className="relative rounded-lg border border-scroll-300 overflow-hidden bg-scroll-100">
      {profile.backgroundPreview && (
        <img
          src={profile.backgroundPreview}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-105"
          style={{ filter: `blur(${(profile.backgroundBlur / 100) * 16}px)` }}
        />
      )}
      <div className="relative z-10 p-4 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="text-center">
          <h2 style={{ fontFamily: pairFontFamily(profile.titleFont), color: profile.titleColor, fontSize: `clamp(18px, 4vw, ${Math.min(profile.titleSize, 34)}px)` }}>
            {profile.title || '페어 제목'}
          </h2>
          <PairLink text={profile.linkText} url={profile.linkUrl} font={profile.linkFont} color={profile.linkColor} hasMusic={profile.hasMusic} centered />
        </div>

        <div className="relative">
          <img src={pairImage} alt="" className="w-full h-auto max-h-[340px] object-cover rounded block" />
          {profile.illustrationSource && (
            <p className="text-center text-[10px] mt-1.5" style={{ fontFamily: pairFontFamily(profile.illustrationSourceFont), color: profile.illustrationSourceColor }}>
              ©{profile.illustrationSource}
            </p>
          )}
          {showCaptions && (
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex items-center justify-between gap-3 pointer-events-none">
              <CaptionBlock character={char1} align="left" />
              <CaptionBlock character={char2} align="right" />
            </div>
          )}
        </div>

        {(char1.sections.length > 0 || char2.sections.length > 0) && (
          <div className="grid grid-cols-1 min-[700px]:grid-cols-2 gap-3">
            <DescriptionColumn character={char1} align="left" />
            <DescriptionColumn character={char2} align="right" />
          </div>
        )}

        <TimelinePreview profile={profile} />
      </div>
    </div>
  )
}
