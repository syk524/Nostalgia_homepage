'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GripVertical, Star, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, uploadHtmlPage } from '@/lib/upload'
import { createCharacterPair, updateCharacterPair, type TimelineEntryInput } from '@/lib/actions/characters'
import { PAIR_FONTS, pairFontFamily } from '@/lib/fonts'
import { ColorSwatch } from '@/components/color-swatch'
import { PairDescriptionEditor } from '@/components/pair-description-editor'
import type { CharacterPairWithProfiles, PairProfileWithContent } from '@/lib/character-pair-queries'
import type { ProfileCharacter } from '@/types/database'

// `id` here is a client-only key (existing sections keep their real db id;
// new ones get a fresh crypto.randomUUID()) — it never gets sent to the
// server. Sections are saved wholesale (delete + reinsert) on every save,
// so the server never needs to match this id back up to a row; it's only
// here so React has a stable key across add/remove/reorder.
type SectionState = { id: string; title: string; titleColor: string; titleFont: string; description: string; textColor: string }

function emptySection(): SectionState {
  return { id: crypto.randomUUID(), title: '', titleColor: '#5c574d', titleFont: 'default', description: '', textColor: '#5c574d' }
}

// Same client-only `id` convention as SectionState — a stable React key
// across add/remove/reorder, never sent to the server (timeline entries
// are saved wholesale, delete + reinsert, same as sections).
type TimelineEntryState = {
  id: string; subtitle: string; subtitleColor: string; title: string; titleColor: string; description: string; char1Thought: string; char2Thought: string
  imageUrl: string | null; imageFile: File | null; imagePreview: string; uploadingImage: boolean
}

function emptyTimelineEntry(): TimelineEntryState {
  return {
    id: crypto.randomUUID(), subtitle: '', subtitleColor: '#5c574d', title: '', titleColor: '#5c574d', description: '', char1Thought: '', char2Thought: '',
    imageUrl: null, imageFile: null, imagePreview: '', uploadingImage: false,
  }
}

// A character's full presentation within one profile — nothing about a
// character (not even their name or avatar) is shared across a pair's
// profiles, so identity and caption content both live here together.
type ProfileCharState = {
  name: string; nameColor: string; nameFont: string; nameUnderlineColor: string
  profileImageUrl: string | null; profileImageFile: File | null; profileImagePreview: string; uploadingProfileImage: boolean
  catchphrase: string; catchphraseColor: string; catchphraseFont: string
  quote: string; quoteColor: string; quoteFont: string
  keyword1: string; keyword2: string; keyword3: string; keywordFont: string; keywordColor: string
  descriptionColor: string
  captionShadowColor: string; captionShadowStrength: number
  captionOffsetY: number
  age: string; height: string; weight: string; job: string; statsColor: string; statsFont: string
  sections: SectionState[]
}

function emptyProfileChar(existing?: ProfileCharacter): ProfileCharState {
  return {
    name: existing?.name ?? '',
    nameColor: existing?.name_color ?? '#5c574d',
    nameFont: existing?.name_font ?? 'default',
    nameUnderlineColor: existing?.name_underline_color ?? '#ffffff',
    profileImageUrl: existing?.profile_image_url ?? null,
    profileImageFile: null,
    profileImagePreview: existing?.profile_image_url ?? '',
    uploadingProfileImage: false,
    catchphrase: existing?.catchphrase ?? '',
    catchphraseColor: existing?.catchphrase_color ?? '#5c574d',
    catchphraseFont: existing?.catchphrase_font ?? 'default',
    quote: existing?.quote ?? '',
    quoteColor: existing?.quote_color ?? '#5c574d',
    quoteFont: existing?.quote_font ?? 'default',
    keyword1: existing?.keyword_1 ?? '',
    keyword2: existing?.keyword_2 ?? '',
    keyword3: existing?.keyword_3 ?? '',
    keywordFont: existing?.keyword_font ?? 'default',
    keywordColor: existing?.keyword_color ?? '#5c574d',
    descriptionColor: existing?.description_color ?? '#5c574d',
    captionShadowColor: existing?.caption_shadow_color ?? '#000000',
    captionShadowStrength: existing?.caption_shadow_strength ?? 2,
    captionOffsetY: existing?.caption_offset_y ?? 0,
    age: existing?.age ?? '',
    height: existing?.height ?? '',
    weight: existing?.weight ?? '',
    job: existing?.job ?? '',
    statsColor: existing?.stats_color ?? '#5c574d',
    statsFont: existing?.stats_font ?? 'default',
    sections: existing
      ? existing.description_sections?.map(s => ({
          id: s.id, title: s.title ?? '', titleColor: s.title_color, titleFont: s.title_font, description: s.description, textColor: s.text_color,
        })) ?? []
      : [emptySection()],
  }
}

// One variant of the pair — a fully self-contained tab in the editor, a
// fully self-contained URL on the public side. Nothing here is shared
// with any other profile of the same pair.
type ProfileState = {
  id: string
  title: string; profileTitle: string; titleFont: string; titleColor: string; titleSize: number; iconColor: string
  linkText: string; linkUrl: string; linkFont: string; linkColor: string; hasMusic: boolean
  isPrimary: boolean
  pageType: 'template' | 'custom_html'
  customHtmlUrl: string | null; customHtmlFile: File | null; customHtmlFileName: string; uploadingCustomHtml: boolean
  pairImageUrl: string | null; pairImageFile: File | null; pairImagePreview: string; uploadingPairImage: boolean
  illustrationSource: string; illustrationSourceFont: string; illustrationSourceColor: string
  backgroundUrl: string | null; backgroundFile: File | null; backgroundPreview: string; uploadingBackground: boolean
  backgroundBlur: number
  timelineSubtitleFont: string; timelineTitleFont: string; timelineTextColor: string; timelineDotColor: string; timelineLineColor: string; timelineShadow: boolean
  timelineEntries: TimelineEntryState[]
  characters: [ProfileCharState, ProfileCharState]
}

function emptyProfile(existing?: PairProfileWithContent): ProfileState {
  const sorted = existing ? [...existing.profile_characters].sort((a, b) => a.slot - b.slot) : undefined

  return {
    id: existing?.id ?? crypto.randomUUID(),
    title: existing?.title ?? '',
    profileTitle: existing?.profile_title ?? '',
    titleFont: existing?.title_font ?? 'default',
    titleColor: existing?.title_color ?? '#5c574d',
    titleSize: existing?.title_size ?? 32,
    iconColor: existing?.icon_color ?? '#5c574d',
    linkText: existing?.link_text ?? '',
    linkUrl: existing?.link_url ?? '',
    linkFont: existing?.link_font ?? 'default',
    linkColor: existing?.link_color ?? '#5c574d',
    hasMusic: existing?.has_music ?? false,
    isPrimary: existing?.is_primary ?? false,
    pageType: existing?.page_type ?? 'template',
    customHtmlUrl: existing?.custom_html_url ?? null,
    customHtmlFile: null,
    customHtmlFileName: existing?.custom_html_url?.split('/').pop() ?? '',
    uploadingCustomHtml: false,
    pairImageUrl: existing?.pair_image_url ?? null,
    pairImageFile: null,
    pairImagePreview: existing?.pair_image_url ?? '',
    uploadingPairImage: false,
    illustrationSource: existing?.illustration_source ?? '',
    illustrationSourceFont: existing?.illustration_source_font ?? 'default',
    illustrationSourceColor: existing?.illustration_source_color ?? '#5c574d',
    backgroundUrl: existing?.background_url ?? null,
    backgroundFile: null,
    backgroundPreview: existing?.background_url ?? '',
    uploadingBackground: false,
    backgroundBlur: existing?.background_blur ?? 1,
    timelineSubtitleFont: existing?.timeline_subtitle_font ?? 'default',
    timelineTitleFont: existing?.timeline_title_font ?? 'default',
    timelineTextColor: existing?.timeline_text_color ?? '#5c574d',
    timelineDotColor: existing?.timeline_dot_color ?? '#5c574d',
    timelineLineColor: existing?.timeline_line_color ?? '#5c574d',
    timelineShadow: existing?.timeline_shadow ?? false,
    timelineEntries: existing
      ? existing.timeline_entries?.map(e => ({
          id: e.id, subtitle: e.subtitle ?? '', subtitleColor: e.subtitle_color, title: e.title ?? '', titleColor: e.title_color,
          description: e.description ?? '', char1Thought: e.char1_thought ?? '', char2Thought: e.char2_thought ?? '',
          imageUrl: e.image_url ?? null, imageFile: null, imagePreview: e.image_url ?? '', uploadingImage: false,
        })) ?? []
      : [emptyTimelineEntry()],
    characters: [emptyProfileChar(sorted?.[0]), emptyProfileChar(sorted?.[1])],
  }
}

export function CharacterPairForm({ initialData }: { initialData?: { pair: CharacterPairWithProfiles } }) {
  const router = useRouter()
  const isEdit = !!initialData

  const [profiles, setProfiles] = useState<ProfileState[]>(() =>
    initialData?.pair.pair_profiles.length
      ? [...initialData.pair.pair_profiles].sort((a, b) => a.position - b.position).map(p => emptyProfile(p))
      // A new pair starts with one empty, starred profile rather than
      // none — every pair created through this form needs at least one.
      : [{ ...emptyProfile(undefined), isPrimary: true }]
  )
  const [activeIndex, setActiveIndex] = useState(0)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateProfile(index: number, patch: Partial<ProfileState>) {
    setProfiles(prev => prev.map((p, i) => i === index ? { ...p, ...patch } : p))
  }
  function updateProfileChar(index: number, slot: 0 | 1, patch: Partial<ProfileCharState>) {
    setProfiles(prev => prev.map((p, i) => {
      if (i !== index) return p
      const characters = [...p.characters] as [ProfileCharState, ProfileCharState]
      characters[slot] = { ...characters[slot], ...patch }
      return { ...p, characters }
    }))
  }
  // Custom HTML is only allowed for non-primary profiles — the star
  // button itself is disabled for those (see the tab bar below) rather
  // than allowing the click and silently switching page type back.
  function setPrimary(index: number) {
    setProfiles(prev => prev.map((p, i) => i === index ? { ...p, isPrimary: true } : { ...p, isPrimary: false }))
  }
  function addProfile() {
    setProfiles(prev => [...prev, emptyProfile(undefined)])
    setActiveIndex(profiles.length)
  }
  function removeProfile(index: number) {
    const next = profiles.filter((_, i) => i !== index)
    setProfiles(next)
    setActiveIndex(prev => Math.min(prev, next.length - 1))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!profiles.length) { setError('At least one profile is required.'); return }
    if (profiles.some(p => p.pageType === 'template' && !p.title.trim())) { setError('Every template profile needs a title.'); return }
    if (profiles.some(p => !p.profileTitle.trim())) { setError('Every profile needs a profile title.'); return }
    if (profiles.some(p => p.pageType === 'template' && (!p.characters[0].name.trim() || !p.characters[1].name.trim()))) { setError('Both characters need a name in every template profile.'); return }
    if (profiles.filter(p => p.isPrimary).length !== 1) { setError('Exactly one profile must be starred as primary.'); return }

    setSubmitting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('You must be signed in.'); setSubmitting(false); return }

    const resolvedProfiles: Parameters<typeof createCharacterPair>[0]['profiles'] = []
    for (const p of profiles) {
      let finalPairImageUrl = p.pairImageUrl
      if (p.pairImageFile) {
        const { url, error: err } = await uploadImage(p.pairImageFile, user.id, 'gallery-images')
        if (err) { setError(err); setSubmitting(false); return }
        finalPairImageUrl = url
      }

      let finalBackgroundUrl = p.backgroundUrl
      if (p.backgroundFile) {
        const { url, error: err } = await uploadImage(p.backgroundFile, user.id, 'gallery-images')
        if (err) { setError(err); setSubmitting(false); return }
        finalBackgroundUrl = url
      }

      let finalCustomHtmlUrl = p.customHtmlUrl
      if (p.customHtmlFile) {
        const { url, error: err } = await uploadHtmlPage(p.customHtmlFile, user.id, 'profile-pages')
        if (err) { setError(err); setSubmitting(false); return }
        finalCustomHtmlUrl = url
      }
      if (p.pageType === 'custom_html' && !finalCustomHtmlUrl) {
        setError(`Upload an HTML file for "${p.title || 'a profile'}".`); setSubmitting(false); return
      }

      const resolvedCharacters: ReturnType<typeof toProfileCharInput>[] = []
      for (const c of p.characters) {
        let finalProfileImageUrl = c.profileImageUrl
        if (c.profileImageFile) {
          const { url, error: err } = await uploadImage(c.profileImageFile, user.id, 'gallery-images')
          if (err) { setError(err); setSubmitting(false); return }
          finalProfileImageUrl = url
        }
        resolvedCharacters.push(toProfileCharInput(c, finalProfileImageUrl))
      }

      const resolvedTimelineEntries: (TimelineEntryInput)[] = []
      for (const entry of p.timelineEntries) {
        let finalEntryImageUrl = entry.imageUrl
        if (entry.imageFile) {
          const { url, error: err } = await uploadImage(entry.imageFile, user.id, 'gallery-images')
          if (err) { setError(err); setSubmitting(false); return }
          finalEntryImageUrl = url
        }
        resolvedTimelineEntries.push({
          subtitle: entry.subtitle, subtitleColor: entry.subtitleColor, title: entry.title, titleColor: entry.titleColor,
          description: entry.description, char1Thought: entry.char1Thought, char2Thought: entry.char2Thought,
          imageUrl: finalEntryImageUrl,
        })
      }

      resolvedProfiles.push({
        title: p.title, profileTitle: p.profileTitle, titleFont: p.titleFont, titleColor: p.titleColor, titleSize: p.titleSize, iconColor: p.iconColor,
        linkText: p.linkText, linkUrl: p.linkUrl, linkFont: p.linkFont, linkColor: p.linkColor, hasMusic: p.hasMusic,
        isPrimary: p.isPrimary, pageType: p.pageType, customHtmlUrl: p.pageType === 'custom_html' ? finalCustomHtmlUrl : null,
        pairImageUrl: finalPairImageUrl,
        illustrationSource: p.illustrationSource, illustrationSourceFont: p.illustrationSourceFont, illustrationSourceColor: p.illustrationSourceColor,
        backgroundUrl: finalBackgroundUrl, backgroundBlur: p.backgroundBlur,
        timelineSubtitleFont: p.timelineSubtitleFont, timelineTitleFont: p.timelineTitleFont, timelineTextColor: p.timelineTextColor,
        timelineDotColor: p.timelineDotColor, timelineLineColor: p.timelineLineColor, timelineShadow: p.timelineShadow,
        timelineEntries: resolvedTimelineEntries,
        characters: resolvedCharacters as [ReturnType<typeof toProfileCharInput>, ReturnType<typeof toProfileCharInput>],
      })
    }

    const input: Parameters<typeof createCharacterPair>[0] = { profiles: resolvedProfiles }

    const result = isEdit
      ? await updateCharacterPair(initialData!.pair.id, input)
      : await createCharacterPair(input)

    if (result?.error || !result?.pairSlug) { setError(result?.error ?? 'Could not save the pair.'); setSubmitting(false); return }
    router.push(`/profile/${result.pairSlug}`)
  }

  const activeProfile = profiles[activeIndex]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        {profiles.map((p, i) => (
          <div key={p.id} className={`pill !gap-1.5 ${i === activeIndex ? 'pill-active' : ''}`}>
            <button type="button" onClick={() => setActiveIndex(i)}>
              {p.profileTitle || `Profile ${i + 1}`}
            </button>
            <button
              type="button"
              onClick={() => setPrimary(i)}
              disabled={p.pageType === 'custom_html'}
              aria-label={p.isPrimary ? 'Primary profile' : p.pageType === 'custom_html' ? 'Custom HTML pages can’t be primary' : 'Make primary'}
              className="shrink-0 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <Star size={12} className={p.isPrimary ? 'fill-current' : 'opacity-40'} />
            </button>
            {profiles.length > 1 && !p.isPrimary && (
              <button type="button" onClick={() => removeProfile(i)} aria-label="Remove profile" className="shrink-0 opacity-60 hover:opacity-100">
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addProfile} className="pill pill-dashed">+ Add profile</button>
      </div>

      <div className="card p-6 space-y-6">
        <ProfileFieldset
          profile={activeProfile}
          onPatch={patch => updateProfile(activeIndex, patch)}
          onPatchChar={(slot, patch) => updateProfileChar(activeIndex, slot, patch)}
        />

        {error && (
          <p className="field-error bg-ember/10 border border-ember/20 rounded px-4 py-2.5 text-sm">{error}</p>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Register Pair'}
          </button>
          <button type="button" onClick={() => router.push(isEdit ? `/profile/${initialData!.pair.slug}` : '/profile')} className="btn-ghost">
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}

function toProfileCharInput(c: ProfileCharState, profileImageUrl: string | null) {
  return {
    name: c.name, nameColor: c.nameColor, nameFont: c.nameFont, nameUnderlineColor: c.nameUnderlineColor, profileImageUrl,
    catchphrase: c.catchphrase, catchphraseColor: c.catchphraseColor, catchphraseFont: c.catchphraseFont,
    quote: c.quote, quoteColor: c.quoteColor, quoteFont: c.quoteFont,
    keyword1: c.keyword1, keyword2: c.keyword2, keyword3: c.keyword3, keywordFont: c.keywordFont, keywordColor: c.keywordColor,
    descriptionColor: c.descriptionColor,
    captionShadowColor: c.captionShadowColor, captionShadowStrength: c.captionShadowStrength, captionOffsetY: c.captionOffsetY,
    age: c.age, height: c.height, weight: c.weight, job: c.job, statsColor: c.statsColor, statsFont: c.statsFont,
    sections: c.sections.map(s => ({ title: s.title, titleColor: s.titleColor, titleFont: s.titleFont, description: s.description, textColor: s.textColor })),
  }
}

function FontSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      className="input"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ fontFamily: pairFontFamily(value) }}
    >
      {Object.entries(PAIR_FONTS).map(([key, { label, family }]) => (
        <option key={key} value={key} style={{ fontFamily: family }}>{label}</option>
      ))}
    </select>
  )
}

function StyledTextRow({
  label, value, placeholder, required, font, color, size, onValueChange, onFontChange, onColorChange, onSizeChange,
}: {
  label: string
  value: string
  placeholder?: string
  required?: boolean
  font: string
  color: string
  size?: number
  onValueChange: (value: string) => void
  onFontChange: (value: string) => void
  onColorChange: (value: string) => void
  onSizeChange?: (value: number) => void
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-3">
        <input
          className="input flex-1 min-w-[140px]"
          value={value}
          onChange={e => onValueChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={{ fontFamily: pairFontFamily(font) }}
        />
        <div className="w-36">
          <FontSelect value={font} onChange={onFontChange} />
        </div>
        {size !== undefined && onSizeChange && (
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={12}
              max={96}
              value={size}
              onChange={e => onSizeChange(Number(e.target.value))}
              className="input w-16 text-center"
            />
            <span className="text-xs text-ink-500">px</span>
          </div>
        )}
        <ColorSwatch value={color} onChange={onColorChange} />
      </div>
    </div>
  )
}

// Everything about one profile: its title/link/icon color, which page
// type it is, its image/background, both characters (full identity +
// caption), and its own timeline. A full page's worth of input — nothing
// here is inherited from anywhere else.
function ProfileFieldset({
  profile, onPatch, onPatchChar,
}: {
  profile: ProfileState
  onPatch: (patch: Partial<ProfileState>) => void
  onPatchChar: (slot: 0 | 1, patch: Partial<ProfileCharState>) => void
}) {
  function handlePairImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onPatch({ pairImageFile: file, pairImagePreview: URL.createObjectURL(file) })
  }
  function handleBackgroundChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onPatch({ backgroundFile: file, backgroundPreview: URL.createObjectURL(file) })
  }
  function handleCustomHtmlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onPatch({ customHtmlFile: file, customHtmlFileName: file.name })
  }

  return (
    <div className="space-y-6">
      <p className="text-base font-semibold text-ink uppercase tracking-wide font-mono">Profile Info</p>

      <div>
        <label className="label">Page type</label>
        <select className="input" value={profile.pageType} onChange={e => onPatch({ pageType: e.target.value as ProfileState['pageType'] })}>
          <option value="template">Standard template</option>
          <option value="custom_html" disabled={profile.isPrimary}>Custom HTML page</option>
        </select>
        {profile.isPrimary && (
          <p className="text-xs text-ink-400 mt-1">The starred profile always uses the standard template — star a different profile to free this one up for a custom page.</p>
        )}
      </div>

      <div>
        <label className="label">Profile Title</label>
        <input
          className="input"
          value={profile.profileTitle}
          onChange={e => onPatch({ profileTitle: e.target.value })}
          placeholder="e.g. Debut Era"
          required
        />
      </div>

      <p className="pt-6 text-base font-semibold text-ink uppercase tracking-wide font-mono border-t border-scroll-300">Pair Info</p>

      {profile.pageType !== 'custom_html' && (
        <>
          <StyledTextRow
            label="Title"
            value={profile.title}
            placeholder="Pair title"
            required
            font={profile.titleFont}
            color={profile.titleColor}
            size={profile.titleSize}
            onValueChange={v => onPatch({ title: v })}
            onFontChange={v => onPatch({ titleFont: v })}
            onColorChange={v => onPatch({ titleColor: v })}
            onSizeChange={v => onPatch({ titleSize: v })}
          />

          <div>
            <label className="label">Link (optional)</label>
            <div className="flex flex-wrap gap-3">
              <input
                className="input flex-1 min-w-[140px]"
                value={profile.linkText}
                onChange={e => onPatch({ linkText: e.target.value })}
                placeholder="Link text"
                style={{ fontFamily: pairFontFamily(profile.linkFont) }}
              />
              <div className="w-36">
                <FontSelect value={profile.linkFont} onChange={v => onPatch({ linkFont: v })} />
              </div>
              <ColorSwatch value={profile.linkColor} onChange={v => onPatch({ linkColor: v })} />
            </div>
            <input
              type="url"
              className="input w-full mt-2"
              value={profile.linkUrl}
              onChange={e => onPatch({ linkUrl: e.target.value })}
              placeholder="https://…"
            />
            <label className="flex items-center gap-2 mt-2 text-xs text-ink-500 normal-case tracking-normal">
              <input type="checkbox" checked={profile.hasMusic} onChange={e => onPatch({ hasMusic: e.target.checked })} className="cursor-pointer" />
              Show a music note icon before the link text
            </label>
          </div>
        </>
      )}

      <div>
        <label className="label">Icon color picker</label>
        <ColorSwatch value={profile.iconColor} onChange={v => onPatch({ iconColor: v })} />
      </div>

      {profile.pageType === 'custom_html' ? (
        <div>
          <label className="label">HTML file</label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-500">{profile.customHtmlFileName || 'No file chosen'}</span>
            <label className="btn-ghost text-xs cursor-pointer" aria-busy={profile.uploadingCustomHtml}>
              {profile.uploadingCustomHtml ? 'Uploading…' : 'Choose file'}
              <input type="file" accept=".html,text/html" onChange={handleCustomHtmlChange} className="sr-only" disabled={profile.uploadingCustomHtml} />
            </label>
          </div>
          <p className="text-xs text-ink-400 mt-1">A single self-contained .html file, rendered in a sandboxed frame.</p>
        </div>
      ) : (
        <>
          <div>
            <label className="label">Pair image</label>
            <div className="flex items-center gap-4">
              <div className="w-32 aspect-video rounded border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
                {profile.pairImagePreview
                  ? <img src={profile.pairImagePreview} alt="" className="w-full h-full object-cover" />
                  : <span className="text-2xl text-scroll-400">◯</span>
                }
              </div>
              <label className="btn-ghost text-xs cursor-pointer" aria-busy={profile.uploadingPairImage}>
                {profile.uploadingPairImage ? 'Uploading…' : 'Choose image'}
                <input type="file" accept="image/*" onChange={handlePairImageChange} className="sr-only" disabled={profile.uploadingPairImage} />
              </label>
            </div>
          </div>

          <div>
            <label className="label">Illustration source (optional)</label>
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[140px]">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-ink/50"
                  style={{ fontFamily: pairFontFamily(profile.illustrationSourceFont) }}
                >
                  ©
                </span>
                <input
                  className="input pl-8"
                  value={profile.illustrationSource}
                  onChange={e => onPatch({ illustrationSource: e.target.value })}
                  placeholder="e.g. 부때"
                  style={{ fontFamily: pairFontFamily(profile.illustrationSourceFont) }}
                />
              </div>
              <div className="w-36">
                <FontSelect value={profile.illustrationSourceFont} onChange={v => onPatch({ illustrationSourceFont: v })} />
              </div>
              <ColorSwatch value={profile.illustrationSourceColor} onChange={v => onPatch({ illustrationSourceColor: v })} />
            </div>
          </div>

          <div>
            <label className="label">Background</label>
            <div className="flex items-center gap-4">
              <div className="w-32 aspect-video rounded border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
                {profile.backgroundPreview
                  ? <img src={profile.backgroundPreview} alt="" className="w-full h-full object-cover" />
                  : <span className="text-2xl text-scroll-400">◯</span>
                }
              </div>
              <label className="btn-ghost text-xs cursor-pointer" aria-busy={profile.uploadingBackground}>
                {profile.uploadingBackground ? 'Uploading…' : 'Choose image'}
                <input type="file" accept="image/*" onChange={handleBackgroundChange} className="sr-only" disabled={profile.uploadingBackground} />
              </label>
            </div>
            <div className="mt-3">
              <label className="label flex items-center justify-between" htmlFor={`background-blur-${profile.id}`}>
                <span>Background image blur strength</span>
                <span className="text-ink-500 normal-case tracking-normal">{profile.backgroundBlur}%</span>
              </label>
              <input
                id={`background-blur-${profile.id}`}
                type="range"
                min={1}
                max={100}
                step={1}
                value={profile.backgroundBlur}
                onChange={e => onPatch({ backgroundBlur: Number(e.target.value) })}
                className="w-full block"
                style={{ accentColor: '#5c574d' }}
              />
            </div>
          </div>

          <CharacterFieldset label="Character 1" state={profile.characters[0]} onPatch={patch => onPatchChar(0, patch)} />
          <CharacterFieldset label="Character 2" state={profile.characters[1]} onPatch={patch => onPatchChar(1, patch)} />

          <div className="space-y-4 pt-4 border-t border-scroll-300">
            <p className="pt-6 text-base font-semibold text-ink uppercase tracking-wide font-mono">Timeline</p>

            <div>
              <label className="label">Subtitle &amp; title font</label>
              <div className="flex flex-wrap gap-3">
                <div className="w-36">
                  <FontSelect value={profile.timelineSubtitleFont} onChange={v => onPatch({ timelineSubtitleFont: v })} />
                </div>
                <div className="w-36">
                  <FontSelect value={profile.timelineTitleFont} onChange={v => onPatch({ timelineTitleFont: v })} />
                </div>
              </div>
            </div>

            <div>
              <label className="label">Description text color</label>
              <ColorSwatch value={profile.timelineTextColor} onChange={v => onPatch({ timelineTextColor: v })} />
            </div>

            <div>
              <label className="label">Dot &amp; line</label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-ink-400 normal-case tracking-normal">Circle</span>
                  <ColorSwatch value={profile.timelineDotColor} onChange={v => onPatch({ timelineDotColor: v })} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-ink-400 normal-case tracking-normal">Line</span>
                  <ColorSwatch value={profile.timelineLineColor} onChange={v => onPatch({ timelineLineColor: v })} />
                </div>
                <label className="flex items-center gap-2 text-xs text-ink-500 normal-case tracking-normal cursor-pointer">
                  <input type="checkbox" checked={profile.timelineShadow} onChange={e => onPatch({ timelineShadow: e.target.checked })} className="cursor-pointer" />
                  Add a shadow behind them
                </label>
              </div>
            </div>

            <TimelineEditor
              entries={profile.timelineEntries}
              onChange={entries => onPatch({ timelineEntries: entries })}
              char1Name={profile.characters[0].name}
              char2Name={profile.characters[1].name}
            />
          </div>
        </>
      )}
    </div>
  )
}

function CharacterFieldset({
  label, state, onPatch,
}: {
  label: string
  state: ProfileCharState
  onPatch: (patch: Partial<ProfileCharState>) => void
}) {
  function handleProfileImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onPatch({ profileImageFile: file, profileImagePreview: URL.createObjectURL(file) })
  }

  return (
    <div className="space-y-4 pt-4 border-t border-scroll-300">
      <p className="pt-6 text-base font-semibold text-ink uppercase tracking-wide font-mono">{label}</p>

      <div>
        <label className="label">Profile picture</label>
        <p className="text-xs text-ink-400 mb-2">Shown as this character's icon on the timeline's thought hovers.</p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
            {state.profileImagePreview
              ? <img src={state.profileImagePreview} alt="" className="w-full h-full object-cover" />
              : <span className="text-xl text-scroll-400">◯</span>
            }
          </div>
          <label className="btn-ghost text-xs cursor-pointer" aria-busy={state.uploadingProfileImage}>
            {state.uploadingProfileImage ? 'Uploading…' : 'Choose image'}
            <input type="file" accept="image/*" onChange={handleProfileImageChange} className="sr-only" disabled={state.uploadingProfileImage} />
          </label>
        </div>
      </div>

      <StyledTextRow
        label="Name"
        value={state.name}
        placeholder="Character name"
        required
        font={state.nameFont}
        color={state.nameColor}
        onValueChange={v => onPatch({ name: v })}
        onFontChange={v => onPatch({ nameFont: v })}
        onColorChange={v => onPatch({ nameColor: v })}
      />

      <div>
        <label className="label">Line under name</label>
        <ColorSwatch value={state.nameUnderlineColor} onChange={v => onPatch({ nameUnderlineColor: v })} />
      </div>

      {/* Shown on the detail page as one line under the character's
          (re-shown) name, above their description sections — reported
          directly. Age/height/weight are just the number here; "세"/"cm"/
          "kg" are added automatically at render time
          (character-pair-detail.tsx), not typed in. */}
      <div>
        <label className="label">Stats</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            className="input"
            value={state.age}
            onChange={e => onPatch({ age: e.target.value })}
            placeholder="Age"
          />
          <div className="relative">
            <input
              className="input pr-9"
              value={state.height}
              onChange={e => onPatch({ height: e.target.value })}
              placeholder="Height"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 pointer-events-none">cm</span>
          </div>
          <div className="relative">
            <input
              className="input pr-9"
              value={state.weight}
              onChange={e => onPatch({ weight: e.target.value })}
              placeholder="Weight"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 pointer-events-none">kg</span>
          </div>
          <input
            className="input"
            value={state.job}
            onChange={e => onPatch({ job: e.target.value })}
            placeholder="Job"
          />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-36">
            <FontSelect value={state.statsFont} onChange={v => onPatch({ statsFont: v })} />
          </div>
          <ColorSwatch value={state.statsColor} onChange={v => onPatch({ statsColor: v })} />
        </div>
      </div>

      <p className="pt-6 text-sm font-semibold text-ink/70 uppercase tracking-wide font-mono">Character Caption</p>

      <StyledTextRow
        label="Catchphrase"
        value={state.catchphrase}
        placeholder="A short tagline"
        font={state.catchphraseFont}
        color={state.catchphraseColor}
        onValueChange={v => onPatch({ catchphrase: v })}
        onFontChange={v => onPatch({ catchphraseFont: v })}
        onColorChange={v => onPatch({ catchphraseColor: v })}
      />

      <StyledTextRow
        label="Quote"
        value={state.quote}
        placeholder="A signature line"
        font={state.quoteFont}
        color={state.quoteColor}
        onValueChange={v => onPatch({ quote: v })}
        onFontChange={v => onPatch({ quoteFont: v })}
        onColorChange={v => onPatch({ quoteColor: v })}
      />

      <div>
        <label className="label">Keywords</label>
        <div className="flex flex-wrap gap-3">
          {(['keyword1', 'keyword2', 'keyword3'] as const).map((key, i) => (
            <input
              key={key}
              className="input flex-1 min-w-[100px]"
              value={state[key]}
              onChange={e => onPatch({ [key]: e.target.value })}
              placeholder={`Keyword ${i + 1}`}
              style={{ fontFamily: pairFontFamily(state.keywordFont) }}
            />
          ))}
          <div className="w-36">
            <FontSelect value={state.keywordFont} onChange={v => onPatch({ keywordFont: v })} />
          </div>
          <ColorSwatch value={state.keywordColor} onChange={v => onPatch({ keywordColor: v })} />
        </div>
      </div>

      <div>
        <label className="label flex items-center justify-between gap-3">
          <span>Caption text shadow</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 w-40 shrink-0">
              <span className="text-[10px] text-ink-400 normal-case tracking-normal shrink-0">Strength</span>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={state.captionShadowStrength}
                onChange={e => onPatch({ captionShadowStrength: Number(e.target.value) })}
                className="input flex-1 min-w-0 text-center"
              />
            </div>
            <ColorSwatch value={state.captionShadowColor} onChange={v => onPatch({ captionShadowColor: v })} />
          </div>
        </label>
      </div>

      <div>
        <label className="label flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            Caption vertical offset
            <span className="text-[10px] text-ink-400 normal-case tracking-normal">(200px to -200px)</span>
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={-200}
              max={200}
              step={1}
              value={state.captionOffsetY}
              onChange={e => onPatch({ captionOffsetY: Math.min(200, Math.max(-200, Number(e.target.value))) })}
              className="input w-20 text-center"
            />
            <span className="text-[10px] text-ink-400 normal-case tracking-normal">px</span>
          </div>
        </label>
      </div>

      <p className="pt-6 text-sm font-semibold text-ink/70 uppercase tracking-wide font-mono">Description</p>

      <div>
        <label className="label">Description background gradient</label>
        <ColorSwatch value={state.descriptionColor} onChange={v => onPatch({ descriptionColor: v })} />
      </div>

      <SectionsEditor sections={state.sections} onChange={sections => onPatch({ sections })} />
    </div>
  )
}

// Add/delete/reorder are all client-side state edits — nothing is
// persisted until the whole pair is saved (see saveProfiles in
// characters.ts, which replaces a profile's section set wholesale).
// Drag-and-drop reorder mirrors image-manager.tsx's native HTML5
// draggable/onDragStart/onDrop pattern rather than pulling in a DnD
// library for one more reorderable list.
function SectionsEditor({ sections, onChange }: { sections: SectionState[]; onChange: (sections: SectionState[]) => void }) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function patch(index: number, p: Partial<SectionState>) {
    onChange(sections.map((s, i) => i === index ? { ...s, ...p } : s))
  }
  function add() {
    onChange([...sections, emptySection()])
  }
  function remove(index: number) {
    onChange(sections.filter((_, i) => i !== index))
  }
  function reorder(from: number, to: number) {
    const next = [...sections]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }
  // Copies this section's title font plus both colors to every other
  // section for this character — per the scope decided for this feature,
  // it only reaches this character's own sections, not the other
  // character's.
  function applyToAll(index: number) {
    const { titleColor, titleFont, textColor } = sections[index]
    onChange(sections.map(s => ({ ...s, titleColor, titleFont, textColor })))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="label mb-0">Description sections</label>
        <button type="button" onClick={add} className="btn-ghost text-xs px-2 py-1">+ Add section</button>
      </div>

      {!sections.length && <p className="text-xs text-ink-400">No sections yet — add one to give this character a description.</p>}

      {sections.map((section, i) => (
        <div
          key={section.id}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (dragIndex !== null && dragIndex !== i) reorder(dragIndex, i); setDragIndex(null) }}
          onDragEnd={() => setDragIndex(null)}
          className="rounded border border-scroll-300 bg-scroll-50 p-3 space-y-2"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <GripVertical size={14} className="text-ink-300 shrink-0 cursor-move" />
            <input
              className="input flex-1 min-w-[120px]"
              value={section.title}
              onChange={e => patch(i, { title: e.target.value })}
              placeholder="Section title (optional)"
              style={{ fontFamily: pairFontFamily(section.titleFont) }}
            />
            <div className="w-32 shrink-0">
              <FontSelect value={section.titleFont} onChange={v => patch(i, { titleFont: v })} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-ink-400 normal-case tracking-normal">Title</span>
              <ColorSwatch value={section.titleColor} onChange={v => patch(i, { titleColor: v })} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-ink-400 normal-case tracking-normal">Text</span>
              <ColorSwatch value={section.textColor} onChange={v => patch(i, { textColor: v })} />
            </div>
            <button type="button" onClick={() => remove(i)} aria-label="Remove section" className="text-ink-400 hover:text-ember shrink-0">
              <X size={16} />
            </button>
          </div>
          {sections.length > 1 && (
            <button type="button" onClick={() => applyToAll(i)} className="text-xs text-ink-400 hover:text-ink underline underline-offset-2">
              Apply these styles to all sections
            </button>
          )}
          <PairDescriptionEditor content={section.description} onChange={v => patch(i, { description: v })} />
        </div>
      ))}
    </div>
  )
}

// One consolidated list per profile (not per character) — mirrors
// SectionsEditor's add/remove/reorder mechanics, minus the per-item
// font/color controls (those live once, above this editor, as the shared
// timeline style) and plus the two per-character thought fields.
function TimelineEditor({
  entries, onChange, char1Name, char2Name,
}: {
  entries: TimelineEntryState[]
  onChange: (entries: TimelineEntryState[]) => void
  char1Name: string
  char2Name: string
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function patch(index: number, p: Partial<TimelineEntryState>) {
    onChange(entries.map((e, i) => i === index ? { ...e, ...p } : e))
  }
  function handleImageChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    patch(index, { imageFile: file, imagePreview: URL.createObjectURL(file) })
  }
  function add() {
    onChange([...entries, emptyTimelineEntry()])
  }
  function remove(index: number) {
    onChange(entries.filter((_, i) => i !== index))
  }
  function reorder(from: number, to: number) {
    const next = [...entries]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }
  // Copies this entry's subtitle + title colors to every other entry —
  // same shape as SectionsEditor's applyToAll, minus font (the timeline's
  // subtitle/title fonts are already shared pair-wide, not per-entry).
  function applyToAll(index: number) {
    const { subtitleColor, titleColor } = entries[index]
    onChange(entries.map(e => ({ ...e, subtitleColor, titleColor })))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="label mb-0">Timeline entries</label>
        <button type="button" onClick={add} className="btn-ghost text-xs px-2 py-1">+ Add entry</button>
      </div>

      {!entries.length && <p className="text-xs text-ink-400">No entries yet — add one to give this profile a timeline.</p>}

      {entries.map((entry, i) => (
        <div
          key={entry.id}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (dragIndex !== null && dragIndex !== i) reorder(dragIndex, i); setDragIndex(null) }}
          onDragEnd={() => setDragIndex(null)}
          className="rounded border border-scroll-300 bg-scroll-50 p-3 space-y-2"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <GripVertical size={14} className="text-ink-300 shrink-0 cursor-move" />
            <input
              className="input flex-1 min-w-[120px]"
              value={entry.subtitle}
              onChange={e => patch(i, { subtitle: e.target.value })}
              placeholder="Subtitle (e.g. Before debut)"
            />
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-ink-400 normal-case tracking-normal">Subtitle</span>
              <ColorSwatch value={entry.subtitleColor} onChange={v => patch(i, { subtitleColor: v })} />
            </div>
            <button type="button" onClick={() => remove(i)} aria-label="Remove entry" className="text-ink-400 hover:text-ember shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="input flex-1 min-w-[120px]"
              value={entry.title}
              onChange={e => patch(i, { title: e.target.value })}
              placeholder="Title"
            />
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-ink-400 normal-case tracking-normal">Title</span>
              <ColorSwatch value={entry.titleColor} onChange={v => patch(i, { titleColor: v })} />
            </div>
          </div>
          {entries.length > 1 && (
            <button type="button" onClick={() => applyToAll(i)} className="text-xs text-ink-400 hover:text-ink underline underline-offset-2">
              Apply these colors to all entries
            </button>
          )}
          <textarea
            className="textarea"
            rows={3}
            value={entry.description}
            onChange={e => patch(i, { description: e.target.value })}
            placeholder="Entry text"
          />
          {/* Same preview-tile + file-input pattern as the pair/background
              pickers above — optional, shown below the entry's own
              description on the profile page (character-pair-timeline.tsx),
              so the editor's field order matches. */}
          <div className="flex items-center gap-4">
            <div className="w-24 aspect-video rounded border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
              {entry.imagePreview
                ? <img src={entry.imagePreview} alt="" className="w-full h-full object-cover" />
                : <span className="text-lg text-scroll-400">◯</span>
              }
            </div>
            <label className="btn-ghost text-xs cursor-pointer" aria-busy={entry.uploadingImage}>
              {entry.uploadingImage ? 'Uploading…' : 'Choose image'}
              <input type="file" accept="image/*" onChange={e => handleImageChange(i, e)} className="sr-only" disabled={entry.uploadingImage} />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <textarea
              className="textarea"
              rows={2}
              value={entry.char1Thought}
              onChange={e => patch(i, { char1Thought: e.target.value })}
              placeholder={`${char1Name || 'Character 1'}’s thought (optional)`}
            />
            <textarea
              className="textarea"
              rows={2}
              value={entry.char2Thought}
              onChange={e => patch(i, { char2Thought: e.target.value })}
              placeholder={`${char2Name || 'Character 2'}’s thought (optional)`}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
