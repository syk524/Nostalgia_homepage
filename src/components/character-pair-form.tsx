'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, ChevronUp, GripVertical, Star, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, uploadHtmlPage } from '@/lib/upload'
import { createCharacterPair, updateCharacterPair, type TimelineEntryInput } from '@/lib/actions/characters'
import { PAIR_FONTS, pairFontFamily } from '@/lib/fonts'
import { ColorSwatch } from '@/components/color-swatch'
import { PairDescriptionEditor } from '@/components/pair-description-editor'
import type { CharacterPairWithProfiles, PairProfileWithContent } from '@/lib/character-pair-queries'
import type { ProfileCharacter } from '@/types/database'

// Sections a profile can jump to via SectionNav below — Pair Info/
// Character 1/Character 2/Timeline only exist for template pages, so the
// list itself is computed per-profile (see sectionsFor below) rather than
// being one fixed constant.
type NavSection = { id: string; label: string }
function sectionsFor(pageType: 'template' | 'custom_html'): NavSection[] {
  const base: NavSection[] = [{ id: 'section-profile-info', label: '프로필 정보' }]
  if (pageType === 'custom_html') return base
  return [
    ...base,
    { id: 'section-pair-info', label: '페어 정보' },
    { id: 'section-char-1', label: '캐릭터 1' },
    { id: 'section-char-2', label: '캐릭터 2' },
    { id: 'section-timeline', label: '타임라인' },
  ]
}

// Scroll-spy nav for the long per-profile form below — plain
// IntersectionObserver against each section's own heading, re-subscribed
// whenever the active profile's section list changes (switching profiles
// or toggling page type changes which ids exist in the DOM). Takes
// pageType (not a precomputed sections array) and derives the list itself
// via useMemo — sectionsFor's return is a fresh array on every call, and
// building it inline at the call site (as this used to) meant the effect
// below reran (recreating the observer and resetting activeId back to the
// first section) on every render of the whole form, i.e. every keystroke
// anywhere in it, not just on an actual pageType/profile change.
function SectionNav({ pageType }: { pageType: 'template' | 'custom_html' }) {
  const sections = useMemo(() => sectionsFor(pageType), [pageType])
  const [activeId, setActiveId] = useState(sections[0]?.id)

  useEffect(() => {
    setActiveId(sections[0]?.id)
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -70% 0px' },
    )
    sections.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections])

  // Fixed at the same left-[2.6%]/z-[60] position the rest of the site's
  // side navs use (PairProfileSideNav, Nav's own gallery category rail) —
  // not a grid column — so this reads as the same "side nav" affordance
  // rather than a one-off layout for just this page. Color comes from
  // --theme-accent (same var/color-mix treatment as Nav's own category
  // rail), not a fixed text-ink/text-ink-400 pair — those default to a
  // dark ink shade that's invisible against Noir's near-black page.
  return (
    <nav className="hidden min-[1020px]:flex flex-col items-start gap-3 font-mono fixed left-[2.6%] top-1/2 -translate-y-1/2 z-[60] text-[14px] uppercase tracking-tight">
      {sections.map((s, i) => {
        const active = s.id === activeId
        // The first section's heading already sits at (or very near) the
        // top of the scrollable content, so scrollIntoView often computes
        // to little or no actual movement there — clicking it looked like
        // it did nothing. Scrolling the window straight to 0 instead gives
        // it the same definitive, obviously-working jump every other
        // section already has.
        function jump() {
          if (i === 0) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
          document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        return (
          <button
            key={s.id}
            type="button"
            onClick={jump}
            className={`flex items-center gap-2 ${active ? 'font-medium' : ''}`}
            style={{ color: active ? 'var(--theme-accent)' : 'color-mix(in srgb, var(--theme-accent) 60%, transparent)' }}
          >
            <span>{s.label}</span>
            {active && <span className="h-[6px] w-[6px] rounded-full bg-current shrink-0" />}
          </button>
        )
      })}
    </nav>
  )
}

// `id` here is a client-only key (existing sections keep their real db id;
// new ones get a fresh crypto.randomUUID()) — it never gets sent to the
// server. Sections are saved wholesale (delete + reinsert) on every save,
// so the server never needs to match this id back up to a row; it's only
// here so React has a stable key across add/remove/reorder.
type SectionState = { id: string; title: string; titleColor: string; titleFont: string; description: string; textColor: string }

function emptySection(): SectionState {
  return { id: crypto.randomUUID(), title: '', titleColor: '#2f2f2e', titleFont: 'default', description: '', textColor: '#2f2f2e' }
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
    id: crypto.randomUUID(), subtitle: '', subtitleColor: '#2f2f2e', title: '', titleColor: '#2f2f2e', description: '', char1Thought: '', char2Thought: '',
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
    nameColor: existing?.name_color ?? '#2f2f2e',
    nameFont: existing?.name_font ?? 'default',
    nameUnderlineColor: existing?.name_underline_color ?? '#ffffff',
    profileImageUrl: existing?.profile_image_url ?? null,
    profileImageFile: null,
    profileImagePreview: existing?.profile_image_url ?? '',
    uploadingProfileImage: false,
    catchphrase: existing?.catchphrase ?? '',
    catchphraseColor: existing?.catchphrase_color ?? '#2f2f2e',
    catchphraseFont: existing?.catchphrase_font ?? 'default',
    quote: existing?.quote ?? '',
    quoteColor: existing?.quote_color ?? '#2f2f2e',
    quoteFont: existing?.quote_font ?? 'default',
    keyword1: existing?.keyword_1 ?? '',
    keyword2: existing?.keyword_2 ?? '',
    keyword3: existing?.keyword_3 ?? '',
    keywordFont: existing?.keyword_font ?? 'default',
    keywordColor: existing?.keyword_color ?? '#2f2f2e',
    descriptionColor: existing?.description_color ?? '#2f2f2e',
    captionShadowColor: existing?.caption_shadow_color ?? '#000000',
    captionShadowStrength: existing?.caption_shadow_strength ?? 2,
    captionOffsetY: existing?.caption_offset_y ?? 0,
    age: existing?.age ?? '',
    height: existing?.height ?? '',
    weight: existing?.weight ?? '',
    job: existing?.job ?? '',
    statsColor: existing?.stats_color ?? '#2f2f2e',
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
  backgroundOverlayColor: string; backgroundOverlayOpacity: number
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
    titleColor: existing?.title_color ?? '#2f2f2e',
    titleSize: existing?.title_size ?? 32,
    iconColor: existing?.icon_color ?? '#2f2f2e',
    linkText: existing?.link_text ?? '',
    linkUrl: existing?.link_url ?? '',
    linkFont: existing?.link_font ?? 'default',
    linkColor: existing?.link_color ?? '#2f2f2e',
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
    illustrationSourceColor: existing?.illustration_source_color ?? '#2f2f2e',
    backgroundUrl: existing?.background_url ?? null,
    backgroundFile: null,
    backgroundPreview: existing?.background_url ?? '',
    uploadingBackground: false,
    backgroundBlur: existing?.background_blur ?? 1,
    backgroundOverlayColor: existing?.background_overlay_color ?? '#000000',
    backgroundOverlayOpacity: existing?.background_overlay_opacity ?? 0,
    timelineSubtitleFont: existing?.timeline_subtitle_font ?? 'default',
    timelineTitleFont: existing?.timeline_title_font ?? 'default',
    timelineTextColor: existing?.timeline_text_color ?? '#2f2f2e',
    timelineDotColor: existing?.timeline_dot_color ?? '#2f2f2e',
    timelineLineColor: existing?.timeline_line_color ?? '#2f2f2e',
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
    const label = profiles[index].profileTitle || `프로필 ${index + 1}`
    if (!window.confirm(`"${label}"을(를) 삭제하시겠습니까? 제목, 두 캐릭터, 모든 설명 섹션, 전체 타임라인이 삭제됩니다. 저장하기 전까지는 되돌릴 수 없습니다.`)) return
    const next = profiles.filter((_, i) => i !== index)
    setProfiles(next)
    setActiveIndex(prev => Math.min(prev, next.length - 1))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!profiles.length) { setError('프로필이 최소 1개 필요합니다.'); return }
    if (profiles.some(p => p.pageType === 'template' && !p.title.trim())) { setError('모든 템플릿 프로필에는 제목이 필요합니다.'); return }
    if (profiles.some(p => !p.profileTitle.trim())) { setError('모든 프로필에는 프로필 제목이 필요합니다.'); return }
    if (profiles.some(p => p.pageType === 'template' && (!p.characters[0].name.trim() || !p.characters[1].name.trim()))) { setError('모든 템플릿 프로필에서 두 캐릭터 모두 이름이 필요합니다.'); return }
    if (profiles.filter(p => p.isPrimary).length !== 1) { setError('정확히 하나의 프로필만 대표로 지정해야 합니다.'); return }

    setSubmitting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인이 필요합니다.'); setSubmitting(false); return }

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
        setError(`"${p.title || '프로필'}"의 HTML 파일을 업로드하세요.`); setSubmitting(false); return
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
        backgroundOverlayColor: p.backgroundOverlayColor, backgroundOverlayOpacity: p.backgroundOverlayOpacity,
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

    if (result?.error || !result?.pairSlug) { setError(result?.error ?? '페어를 저장할 수 없습니다.'); setSubmitting(false); return }
    router.push(`/profile/${result.pairSlug}`)
  }

  const activeProfile = profiles[activeIndex]

  return (
    <>
      {/* Same fixed left-[2.6%]/top-[3%] position, size, and hover
          treatment as the pair detail page's own back arrow
          (character-pair-detail.tsx) — including sourcing its color from
          this profile's own icon_color, so it looks like literally the
          same button whether you're viewing the pair or editing it. Goes
          back to the pair's own page when editing (matching the Cancel
          button below), or the profile grid for a pair that doesn't exist
          yet. A plain sibling here, not nested inside the form/either page
          wrapper's div — position:fixed only resolves against the real
          viewport as long as no transformed ancestor turns itself into
          its containing block (see the animate-fade-up fix elsewhere in
          this file for the bug that happens when one does). */}
      <Link
        href={isEdit ? `/profile/${initialData!.pair.slug}` : '/profile'}
        aria-label="뒤로 가기"
        className="fixed left-[2.6%] top-[3%] z-[60] inline-flex w-8 h-8 rounded-full items-center justify-start hover:opacity-70 transition-opacity"
        style={{ color: activeProfile.iconColor }}
      >
        <ArrowLeft size={18} />
      </Link>

      <SectionNav pageType={activeProfile.pageType} />

      <form onSubmit={handleSubmit} className="animate-fade-up space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          {profiles.map((p, i) => (
            <div key={p.id} className={`pill !gap-1.5 ${i === activeIndex ? 'pill-active' : ''}`}>
              <button type="button" onClick={() => setActiveIndex(i)}>
                {p.profileTitle || `프로필 ${i + 1}`}
              </button>
              <button
                type="button"
                onClick={() => setPrimary(i)}
                disabled={p.pageType === 'custom_html'}
                aria-label={p.isPrimary ? '대표 프로필' : p.pageType === 'custom_html' ? '커스텀 HTML 페이지는 대표로 지정할 수 없습니다' : '대표로 지정'}
                className="shrink-0 disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <Star size={12} className={p.isPrimary ? 'fill-current' : 'opacity-40'} />
              </button>
              {profiles.length > 1 && !p.isPrimary && (
                <button type="button" onClick={() => removeProfile(i)} aria-label="프로필 삭제" className="shrink-0 opacity-60 hover:opacity-100">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addProfile} className="pill pill-dashed">+ 프로필 추가</button>
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
              {submitting ? '저장 중…' : isEdit ? '변경사항 저장' : '페어 등록'}
            </button>
            <button type="button" onClick={() => router.push(isEdit ? `/profile/${initialData!.pair.slug}` : '/profile')} className="btn-ghost">
              취소
            </button>
          </div>
        </div>
      </form>
    </>
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
        <ColorSwatch value={color} onChange={onColorChange} label={`${label} color`} />
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
      <p id="section-profile-info" className="text-base font-semibold text-ink uppercase tracking-wide font-mono scroll-mt-24">프로필 정보</p>

      <div>
        <label className="label">페이지 유형</label>
        <select className="input" value={profile.pageType} onChange={e => onPatch({ pageType: e.target.value as ProfileState['pageType'] })}>
          <option value="template">기본 템플릿</option>
          <option value="custom_html" disabled={profile.isPrimary}>커스텀 HTML 페이지</option>
        </select>
        {profile.isPrimary && (
          <p className="text-xs text-ink-400 mt-1">별표된 프로필은 항상 기본 템플릿을 사용합니다 — 이 프로필을 커스텀 페이지로 사용하려면 다른 프로필에 별표를 지정하세요.</p>
        )}
      </div>

      <div>
        <label className="label">프로필 제목</label>
        <input
          className="input"
          value={profile.profileTitle}
          onChange={e => onPatch({ profileTitle: e.target.value })}
          placeholder="예: 데뷔 시절"
          required
        />
      </div>

      <p id="section-pair-info" className="pt-6 text-base font-semibold text-ink uppercase tracking-wide font-mono border-t border-scroll-300 scroll-mt-24">페어 정보</p>

      {profile.pageType !== 'custom_html' && (
        <>
          <StyledTextRow
            label="제목"
            value={profile.title}
            placeholder="페어 제목"
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
            <label className="label">링크 (선택)</label>
            <div className="flex flex-wrap gap-3">
              <input
                className="input flex-1 min-w-[140px]"
                value={profile.linkText}
                onChange={e => onPatch({ linkText: e.target.value })}
                placeholder="링크 텍스트"
                style={{ fontFamily: pairFontFamily(profile.linkFont) }}
              />
              <div className="w-36">
                <FontSelect value={profile.linkFont} onChange={v => onPatch({ linkFont: v })} />
              </div>
              <ColorSwatch value={profile.linkColor} onChange={v => onPatch({ linkColor: v })} label="링크 색상" />
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
              링크 텍스트 앞에 음표 아이콘 표시
            </label>
          </div>
        </>
      )}

      <div>
        <label className="label">아이콘 색상 선택</label>
        <ColorSwatch value={profile.iconColor} onChange={v => onPatch({ iconColor: v })} label="아이콘 색상" />
      </div>

      {profile.pageType === 'custom_html' ? (
        <div>
          <label className="label">HTML 파일</label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-500">{profile.customHtmlFileName || '선택된 파일 없음'}</span>
            <label className="btn-ghost text-xs cursor-pointer" aria-busy={profile.uploadingCustomHtml}>
              {profile.uploadingCustomHtml ? '업로드 중…' : '파일 선택'}
              <input type="file" accept=".html,text/html" onChange={handleCustomHtmlChange} className="sr-only" disabled={profile.uploadingCustomHtml} />
            </label>
          </div>
          <p className="text-xs text-ink-400 mt-1">샌드박스 처리된 프레임에서 렌더링되는, 단일 자기 완결형 .html 파일입니다.</p>
        </div>
      ) : (
        <>
          <div>
            <label className="label">페어 이미지</label>
            <div className="flex items-center gap-4">
              <div className="w-32 aspect-video rounded border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
                {profile.pairImagePreview
                  ? <img src={profile.pairImagePreview} alt="" className="w-full h-full object-cover" />
                  : <span className="text-2xl text-scroll-400">◯</span>
                }
              </div>
              <label className="btn-ghost text-xs cursor-pointer" aria-busy={profile.uploadingPairImage}>
                {profile.uploadingPairImage ? '업로드 중…' : '이미지 선택'}
                <input type="file" accept="image/*" onChange={handlePairImageChange} className="sr-only" disabled={profile.uploadingPairImage} />
              </label>
            </div>
          </div>

          <div>
            <label className="label">일러스트 출처 (선택)</label>
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
                  placeholder="예: 부때"
                  style={{ fontFamily: pairFontFamily(profile.illustrationSourceFont) }}
                />
              </div>
              <div className="w-36">
                <FontSelect value={profile.illustrationSourceFont} onChange={v => onPatch({ illustrationSourceFont: v })} />
              </div>
              <ColorSwatch value={profile.illustrationSourceColor} onChange={v => onPatch({ illustrationSourceColor: v })} label="일러스트 출처 색상" />
            </div>
          </div>

          <div>
            <label className="label">배경</label>
            <div className="flex items-center gap-4">
              <div className="w-32 aspect-video rounded border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
                {profile.backgroundPreview
                  ? <img src={profile.backgroundPreview} alt="" className="w-full h-full object-cover" />
                  : <span className="text-2xl text-scroll-400">◯</span>
                }
              </div>
              <label className="btn-ghost text-xs cursor-pointer" aria-busy={profile.uploadingBackground}>
                {profile.uploadingBackground ? '업로드 중…' : '이미지 선택'}
                <input type="file" accept="image/*" onChange={handleBackgroundChange} className="sr-only" disabled={profile.uploadingBackground} />
              </label>
            </div>
            <div className="mt-3">
              <label className="label flex items-center justify-between" htmlFor={`background-blur-${profile.id}`}>
                <span>배경 이미지 흐림 강도</span>
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
                style={{ accentColor: '#2f2f2e' }}
              />
            </div>
            {/* A flat color layer over the background image, independent
                of the blur above — lets a busy background be darkened/
                tinted without also softening it. 0% opacity (the default)
                renders identically to no overlay at all. */}
            <div className="mt-3">
              <label className="label">배경 색상 오버레이</label>
              <div className="flex flex-wrap items-center gap-3">
                <ColorSwatch value={profile.backgroundOverlayColor} onChange={v => onPatch({ backgroundOverlayColor: v })} label="배경 오버레이 색상" />
                <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={profile.backgroundOverlayOpacity}
                    onChange={e => onPatch({ backgroundOverlayOpacity: Number(e.target.value) })}
                    className="w-full block"
                    style={{ accentColor: '#2f2f2e' }}
                  />
                  <span className="text-xs text-ink-500 normal-case tracking-normal w-10 text-right shrink-0">{profile.backgroundOverlayOpacity}%</span>
                </div>
              </div>
            </div>
          </div>

          <CharacterFieldset id="section-char-1" label="캐릭터 1" state={profile.characters[0]} onPatch={patch => onPatchChar(0, patch)} />
          <CharacterFieldset id="section-char-2" label="캐릭터 2" state={profile.characters[1]} onPatch={patch => onPatchChar(1, patch)} />

          <div className="space-y-4 pt-4 border-t border-scroll-300">
            <p id="section-timeline" className="pt-6 text-base font-semibold text-ink uppercase tracking-wide font-mono scroll-mt-24">타임라인</p>

            <div>
              <label className="label">부제목 &amp; 제목 폰트</label>
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
              <label className="label">설명 텍스트 색상</label>
              <ColorSwatch value={profile.timelineTextColor} onChange={v => onPatch({ timelineTextColor: v })} label="타임라인 설명 텍스트 색상" />
            </div>

            <div>
              <label className="label">점 &amp; 선</label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-ink-400 normal-case tracking-normal">원</span>
                  <ColorSwatch value={profile.timelineDotColor} onChange={v => onPatch({ timelineDotColor: v })} label="타임라인 점 색상" />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-ink-400 normal-case tracking-normal">선</span>
                  <ColorSwatch value={profile.timelineLineColor} onChange={v => onPatch({ timelineLineColor: v })} label="타임라인 선 색상" />
                </div>
                <label className="flex items-center gap-2 text-xs text-ink-500 normal-case tracking-normal cursor-pointer">
                  <input type="checkbox" checked={profile.timelineShadow} onChange={e => onPatch({ timelineShadow: e.target.checked })} className="cursor-pointer" />
                  뒤에 그림자 추가
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
  id, label, state, onPatch,
}: {
  id?: string
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
      <p id={id} className="pt-6 text-base font-semibold text-ink uppercase tracking-wide font-mono scroll-mt-24">{label}</p>

      <div>
        <label className="label">프로필 사진</label>
        <p className="text-xs text-ink-400 mb-2">타임라인의 생각 말풍선에 이 캐릭터의 아이콘으로 표시됩니다.</p>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
            {state.profileImagePreview
              ? <img src={state.profileImagePreview} alt="" className="w-full h-full object-cover" />
              : <span className="text-xl text-scroll-400">◯</span>
            }
          </div>
          <label className="btn-ghost text-xs cursor-pointer" aria-busy={state.uploadingProfileImage}>
            {state.uploadingProfileImage ? '업로드 중…' : '이미지 선택'}
            <input type="file" accept="image/*" onChange={handleProfileImageChange} className="sr-only" disabled={state.uploadingProfileImage} />
          </label>
        </div>
      </div>

      <StyledTextRow
        label="이름"
        value={state.name}
        placeholder="캐릭터 이름"
        required
        font={state.nameFont}
        color={state.nameColor}
        onValueChange={v => onPatch({ name: v })}
        onFontChange={v => onPatch({ nameFont: v })}
        onColorChange={v => onPatch({ nameColor: v })}
      />

      <div>
        <label className="label">이름 밑줄</label>
        <ColorSwatch value={state.nameUnderlineColor} onChange={v => onPatch({ nameUnderlineColor: v })} label="이름 밑줄 색상" />
      </div>

      {/* Shown on the detail page as one line under the character's
          (re-shown) name, above their description sections — reported
          directly. Age/height/weight are just the number here; "세"/"cm"/
          "kg" are added automatically at render time
          (character-pair-detail.tsx), not typed in. */}
      <details open className="group pt-2">
        <summary className="text-sm font-semibold text-ink/70 uppercase tracking-wide font-mono cursor-pointer list-none flex items-center gap-1.5 select-none">
          <ChevronDown size={12} className="shrink-0 group-open:hidden" />
          <ChevronUp size={12} className="shrink-0 hidden group-open:block" />
          캐릭터 캡션
        </summary>

        <div className="space-y-4 mt-4">
          <div>
            <StyledTextRow
              label="캐치프레이즈"
              value={state.catchphrase}
              placeholder="짧은 태그라인"
              font={state.catchphraseFont}
              color={state.catchphraseColor}
              onValueChange={v => onPatch({ catchphrase: v })}
              onFontChange={v => onPatch({ catchphraseFont: v })}
              onColorChange={v => onPatch({ catchphraseColor: v })}
            />
            <CharHint value={state.catchphrase} softLimit={18} note="자간이 매우 넓게 적용되어 긴 텍스트는 빨리 줄바꿈됩니다" />
          </div>

          <div>
            <StyledTextRow
              label="인용구"
              value={state.quote}
              placeholder="시그니처 대사"
              font={state.quoteFont}
              color={state.quoteColor}
              onValueChange={v => onPatch({ quote: v })}
              onFontChange={v => onPatch({ quoteFont: v })}
              onColorChange={v => onPatch({ quoteColor: v })}
            />
            <CharHint value={state.quote} softLimit={40} note="박스 너비가 350px로 제한되어 있어 텍스트가 길면 더 많은 줄로 나뉩니다" />
          </div>

          <div>
            <label className="label">키워드</label>
            <div className="flex flex-wrap gap-3">
              {(['keyword1', 'keyword2', 'keyword3'] as const).map((key, i) => (
                <input
                  key={key}
                  className="input flex-1 min-w-[100px]"
                  value={state[key]}
                  onChange={e => onPatch({ [key]: e.target.value })}
                  placeholder={`키워드 ${i + 1}`}
                  style={{ fontFamily: pairFontFamily(state.keywordFont) }}
                />
              ))}
              <div className="w-36">
                <FontSelect value={state.keywordFont} onChange={v => onPatch({ keywordFont: v })} />
              </div>
              <ColorSwatch value={state.keywordColor} onChange={v => onPatch({ keywordColor: v })} label="키워드 색상" />
            </div>
          </div>

          <div>
            <label className="label flex items-center justify-between gap-3">
              <span>캡션 텍스트 그림자</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-40 shrink-0">
                  <span className="text-[10px] text-ink-400 normal-case tracking-normal shrink-0">강도</span>
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
                <ColorSwatch value={state.captionShadowColor} onChange={v => onPatch({ captionShadowColor: v })} label="캡션 그림자 색상" />
              </div>
            </label>
          </div>

          <div>
            <label className="label flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                캡션 수직 오프셋
                <span className="text-[10px] text-ink-400 normal-case tracking-normal">(200px ~ -200px)</span>
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
        </div>
      </details>

      <details open className="group pt-2">
        <summary className="text-sm font-semibold text-ink/70 uppercase tracking-wide font-mono cursor-pointer list-none flex items-center gap-1.5 select-none">
          <ChevronDown size={12} className="shrink-0 group-open:hidden" />
          <ChevronUp size={12} className="shrink-0 hidden group-open:block" />
          설명
        </summary>

        <div className="space-y-4 mt-4">
          <div>
            <label className="label">기본 정보</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                className="input"
                value={state.age}
                onChange={e => onPatch({ age: e.target.value })}
                placeholder="나이"
              />
              <div className="relative">
                <input
                  className="input pr-9"
                  value={state.height}
                  onChange={e => onPatch({ height: e.target.value })}
                  placeholder="키"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 pointer-events-none">cm</span>
              </div>
              <div className="relative">
                <input
                  className="input pr-9"
                  value={state.weight}
                  onChange={e => onPatch({ weight: e.target.value })}
                  placeholder="몸무게"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 pointer-events-none">kg</span>
              </div>
              <input
                className="input"
                value={state.job}
                onChange={e => onPatch({ job: e.target.value })}
                placeholder="직업"
              />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="w-36">
                <FontSelect value={state.statsFont} onChange={v => onPatch({ statsFont: v })} />
              </div>
              <ColorSwatch value={state.statsColor} onChange={v => onPatch({ statsColor: v })} label="기본 정보 색상" />
            </div>
          </div>

          <div>
            <label className="label">설명 배경 그라데이션</label>
            <ColorSwatch value={state.descriptionColor} onChange={v => onPatch({ descriptionColor: v })} label="설명 배경 그라데이션" />
          </div>

          <SectionsEditor sections={state.sections} onChange={sections => onPatch({ sections })} />
        </div>
      </details>
    </div>
  )
}

// Soft, non-blocking guidance under a caption field — there's no hard
// character cap in the schema (these boxes just wrap), so this reports the
// live count plus a one-line reason once it crosses a rough
// comfortable-fit threshold, rather than pretending there's a real limit.
function CharHint({ value, softLimit, note }: { value: string; softLimit: number; note: string }) {
  const count = value.length
  const over = count > softLimit
  return (
    <p className={`text-[10px] mt-1 normal-case tracking-normal ${over ? 'text-ember/80' : 'text-ink-400'}`}>
      {count}자{over ? ` — ${note}` : ''}
    </p>
  )
}

// Keyboard-reachable alternative to the drag handle next to it — native
// HTML5 drag-and-drop (used for the actual reorder below) has no keyboard
// equivalent at all, so without this a keyboard-only user simply couldn't
// reorder these lists.
function ReorderButtons({ index, count, onMove }: { index: number; count: number; onMove: (from: number, to: number) => void }) {
  return (
    <div className="flex flex-col shrink-0 -my-1">
      <button
        type="button"
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label="위로 이동"
        className="text-ink-400 hover:text-ink disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        onClick={() => onMove(index, index + 1)}
        disabled={index === count - 1}
        aria-label="아래로 이동"
        className="text-ink-400 hover:text-ink disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  )
}

// Add/delete/reorder are all client-side state edits — nothing is
// persisted until the whole pair is saved (see saveProfiles in
// characters.ts, which replaces a profile's section set wholesale).
// Drag-and-drop reorder mirrors image-manager.tsx's native HTML5
// draggable/onDragStart/onDrop pattern rather than pulling in a DnD
// library for one more reorderable list; ReorderButtons above gives
// keyboard users the same capability drag-and-drop can't offer them.
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
    if (!window.confirm('이 섹션의 제목 폰트/색상과 텍스트 색상으로 다른 모든 섹션을 덮어쓸까요? 이 작업은 되돌릴 수 없습니다.')) return
    const { titleColor, titleFont, textColor } = sections[index]
    onChange(sections.map(s => ({ ...s, titleColor, titleFont, textColor })))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="label mb-0">설명 섹션</label>
        <button type="button" onClick={add} className="btn-ghost text-xs px-2 py-1">+ 섹션 추가</button>
      </div>

      {!sections.length && <p className="text-xs text-ink-400">아직 섹션이 없습니다 — 캐릭터 설명을 추가하려면 섹션을 만드세요.</p>}

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
            <ReorderButtons index={i} count={sections.length} onMove={reorder} />
            <input
              className="input flex-1 min-w-[120px]"
              value={section.title}
              onChange={e => patch(i, { title: e.target.value })}
              placeholder="섹션 제목 (선택)"
              style={{ fontFamily: pairFontFamily(section.titleFont) }}
            />
            <div className="w-32 shrink-0">
              <FontSelect value={section.titleFont} onChange={v => patch(i, { titleFont: v })} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-ink-400 normal-case tracking-normal">제목</span>
              <ColorSwatch value={section.titleColor} onChange={v => patch(i, { titleColor: v })} label="섹션 제목 색상" />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-ink-400 normal-case tracking-normal">텍스트</span>
              <ColorSwatch value={section.textColor} onChange={v => patch(i, { textColor: v })} label="섹션 텍스트 색상" />
            </div>
            <button type="button" onClick={() => remove(i)} aria-label="섹션 삭제" className="text-ink-400 hover:text-ember shrink-0">
              <X size={16} />
            </button>
          </div>
          {sections.length > 1 && (
            <button type="button" onClick={() => applyToAll(i)} className="text-xs text-ink-400 hover:text-ink underline underline-offset-2">
              이 스타일을 모든 섹션에 적용
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
    if (!window.confirm('이 항목의 부제목/제목 색상으로 다른 모든 항목을 덮어쓸까요? 이 작업은 되돌릴 수 없습니다.')) return
    const { subtitleColor, titleColor } = entries[index]
    onChange(entries.map(e => ({ ...e, subtitleColor, titleColor })))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="label mb-0">타임라인 항목</label>
        <button type="button" onClick={add} className="btn-ghost text-xs px-2 py-1">+ 항목 추가</button>
      </div>

      {!entries.length && <p className="text-xs text-ink-400">아직 항목이 없습니다 — 이 프로필에 타임라인을 추가하려면 항목을 만드세요.</p>}

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
            <ReorderButtons index={i} count={entries.length} onMove={reorder} />
            <input
              className="input flex-1 min-w-[120px]"
              value={entry.subtitle}
              onChange={e => patch(i, { subtitle: e.target.value })}
              placeholder="부제목 (예: 데뷔 전)"
            />
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-ink-400 normal-case tracking-normal">부제목</span>
              <ColorSwatch value={entry.subtitleColor} onChange={v => patch(i, { subtitleColor: v })} label="부제목 색상" />
            </div>
            <button type="button" onClick={() => remove(i)} aria-label="항목 삭제" className="text-ink-400 hover:text-ember shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className="input flex-1 min-w-[120px]"
              value={entry.title}
              onChange={e => patch(i, { title: e.target.value })}
              placeholder="제목"
            />
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-ink-400 normal-case tracking-normal">제목</span>
              <ColorSwatch value={entry.titleColor} onChange={v => patch(i, { titleColor: v })} label="항목 제목 색상" />
            </div>
          </div>
          {entries.length > 1 && (
            <button type="button" onClick={() => applyToAll(i)} className="text-xs text-ink-400 hover:text-ink underline underline-offset-2">
              이 색상을 모든 항목에 적용
            </button>
          )}
          <textarea
            className="textarea"
            rows={3}
            value={entry.description}
            onChange={e => patch(i, { description: e.target.value })}
            placeholder="항목 내용"
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
              {entry.uploadingImage ? '업로드 중…' : '이미지 선택'}
              <input type="file" accept="image/*" onChange={e => handleImageChange(i, e)} className="sr-only" disabled={entry.uploadingImage} />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <textarea
              className="textarea"
              rows={2}
              value={entry.char1Thought}
              onChange={e => patch(i, { char1Thought: e.target.value })}
              placeholder={`${char1Name || '캐릭터 1'}의 생각 (선택)`}
            />
            <textarea
              className="textarea"
              rows={2}
              value={entry.char2Thought}
              onChange={e => patch(i, { char2Thought: e.target.value })}
              placeholder={`${char2Name || '캐릭터 2'}의 생각 (선택)`}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
