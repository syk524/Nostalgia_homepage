'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/slug'
import { deleteOrphanedImages } from '@/lib/storage-cleanup'

type SectionInput = { title: string; titleColor: string; titleFont: string; description: string; textColor: string }
export type TimelineEntryInput = { subtitle: string; subtitleColor: string; title: string; titleColor: string; description: string; char1Thought: string; char2Thought: string; imageUrl: string | null }
// A character's full presentation within one profile — nothing about a
// character is shared across a pair's profiles, so identity (name,
// avatar) lives here alongside caption content.
type ProfileCharInput = {
  name: string; nameColor: string; nameFont: string; nameUnderlineColor: string; profileImageUrl: string | null
  catchphrase: string; catchphraseColor: string; catchphraseFont: string
  quote: string; quoteColor: string; quoteFont: string
  keyword1: string; keyword2: string; keyword3: string; keywordFont: string; keywordColor: string
  descriptionColor: string
  captionShadowColor: string; captionShadowStrength: number; captionOffsetY: number
  age: string; height: string; weight: string; job: string; statsColor: string; statsFont: string
  sections: SectionInput[]
}
type ProfileInput = {
  title: string; profileTitle: string; titleFont: string; titleColor: string; titleSize: number; iconColor: string
  linkText: string; linkUrl: string; linkFont: string; linkColor: string; hasMusic: boolean
  isPrimary: boolean; pageType: 'template' | 'custom_html'; customHtmlUrl: string | null
  pairImageUrl: string | null
  illustrationSource: string; illustrationSourceFont: string; illustrationSourceColor: string
  backgroundUrl: string | null; backgroundBlur: number
  timelineSubtitleFont: string; timelineTitleFont: string; timelineTextColor: string; timelineDotColor: string; timelineLineColor: string; timelineShadow: boolean
  timelineEntries: TimelineEntryInput[]
  characters: [ProfileCharInput, ProfileCharInput]
}
type CharacterPairInput = { profiles: ProfileInput[] }

// Recomputed from the primary profile's title on every save (not just
// once at creation) so the URL always tracks its current display name —
// excludeId keeps an unchanged title from colliding with its own existing
// row on update.
async function uniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, title: string, excludeId?: string): Promise<string> {
  const base = slugify(title)
  let candidate = base
  let suffix = 2
  for (;;) {
    let query = supabase.from('character_pairs').select('id').eq('slug', candidate)
    if (excludeId) query = query.neq('id', excludeId)
    const { data } = await query
    if (!data?.length) return candidate
    candidate = `${base}-${suffix++}`
  }
}

// Profile slugs only need to be unique within their own pair, and a
// wholesale save always has the pair's whole profile set in hand already —
// no DB round-trip needed, just de-dupe against siblings in this same
// submission.
function uniqueProfileSlugs(profiles: ProfileInput[]): string[] {
  const used = new Set<string>()
  return profiles.map(p => {
    const base = slugify(p.profileTitle)
    let candidate = base
    let suffix = 2
    while (used.has(candidate)) candidate = `${base}-${suffix++}`
    used.add(candidate)
    return candidate
  })
}

function validate(input: CharacterPairInput): string | null {
  if (!input.profiles.length) return 'At least one profile is required.'
  if (input.profiles.some(p => p.pageType === 'template' && !p.title.trim())) return 'Every template profile needs a title.'
  if (input.profiles.some(p => !p.profileTitle.trim())) return 'Every profile needs a profile title.'
  if (input.profiles.some(p => p.pageType === 'template' && (!p.characters[0].name.trim() || !p.characters[1].name.trim()))) return 'Both characters need a name in every template profile.'
  const primaryCount = input.profiles.filter(p => p.isPrimary).length
  if (primaryCount !== 1) return 'Exactly one profile must be starred as primary.'
  const primary = input.profiles.find(p => p.isPrimary)!
  if (primary.pageType !== 'template') return 'The primary profile must use the standard template.'
  if (input.profiles.some(p => p.pageType === 'custom_html' && !p.customHtmlUrl)) return 'Upload an HTML file for each custom-page profile.'
  return null
}

export async function createCharacterPair(input: CharacterPairInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const validationErr = validate(input)
  if (validationErr) return { error: validationErr }

  const primary = input.profiles.find(p => p.isPrimary)!
  const slug = await uniqueSlug(supabase, primary.profileTitle)

  const { data: pair, error } = await supabase
    .from('character_pairs')
    .insert({ slug, created_by: user.id })
    .select('id')
    .single()

  if (error || !pair) return { error: error?.message ?? 'Could not create the pair.' }

  const profilesErr = await saveProfiles(supabase, pair.id, input.profiles)
  if (profilesErr) return { error: profilesErr }

  revalidatePath('/profile')
  return { success: true, pairId: pair.id, pairSlug: slug }
}

export async function updateCharacterPair(pairId: string, input: CharacterPairInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const validationErr = validate(input)
  if (validationErr) return { error: validationErr }

  const primary = input.profiles.find(p => p.isPrimary)!
  const slug = await uniqueSlug(supabase, primary.profileTitle, pairId)

  const { data: updated, error } = await supabase
    .from('character_pairs')
    .update({ slug })
    .eq('id', pairId)
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'You don’t have permission to edit this pair.' }

  // Every image URL this pair's OLD rows referenced, fetched before
  // saveProfiles' own delete-then-reinsert below removes those rows
  // (and with them, this app's only record of what they used to point
  // at) — the diff against the new set happens after the save succeeds,
  // see deleteOrphanedImages' own comment for why replaced-or-removed
  // images get cleaned up this way instead of a dedicated *_path column
  // per field. Two flat queries, not one embedded pair_profiles(*,
  // profile_characters(*)) select — pair_profiles' own Relationships
  // array in database.ts is empty (hand-maintained, not generated from
  // the real schema), so the embedded form fails to type-check even
  // though the underlying FK genuinely exists.
  const { data: oldProfiles } = await supabase
    .from('pair_profiles')
    .select('id, pair_image_url, background_url')
    .eq('pair_id', pairId)
  const oldProfileIds = (oldProfiles ?? []).map(p => p.id)
  const { data: oldChars } = oldProfileIds.length
    ? await supabase.from('profile_characters').select('profile_image_url').in('profile_id', oldProfileIds)
    : { data: [] as { profile_image_url: string | null }[] }
  const { data: oldEntries } = oldProfileIds.length
    ? await supabase.from('timeline_entries').select('image_url').in('profile_id', oldProfileIds)
    : { data: [] as { image_url: string | null }[] }
  const oldImageUrls = [
    ...(oldProfiles ?? []).flatMap(p => [p.pair_image_url, p.background_url]),
    ...(oldChars ?? []).map(c => c.profile_image_url),
    ...(oldEntries ?? []).map(e => e.image_url),
  ]

  const profilesErr = await saveProfiles(supabase, pairId, input.profiles)
  if (profilesErr) return { error: profilesErr }

  const newImageUrls = input.profiles.flatMap(p => [
    p.pairImageUrl,
    p.backgroundUrl,
    p.characters[0].profileImageUrl,
    p.characters[1].profileImageUrl,
    ...p.timelineEntries.map(e => e.imageUrl),
  ])
  await deleteOrphanedImages(supabase, oldImageUrls, newImageUrls)

  revalidatePath('/profile')
  // 'layout' covers every /profile/[slug]/[profileSlug] under this pair in
  // one call, since they all share the [slug] segment as their layout root.
  revalidatePath(`/profile/${slug}`, 'layout')
  return { success: true, pairId, pairSlug: slug }
}

// Wholesale replace: delete every profile of this pair (cascades their
// profile_characters, description_sections, and timeline_entries), then
// reinsert the whole submitted set. Profile slugs are computed in-memory
// (see uniqueProfileSlugs) since the full set is already in hand.
async function saveProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pairId: string,
  profiles: ProfileInput[],
): Promise<string | null> {
  await supabase.from('pair_profiles').delete().eq('pair_id', pairId)
  if (!profiles.length) return null

  const slugs = uniqueProfileSlugs(profiles)
  const profileRows = profiles.map((p, position) => ({
    pair_id: pairId, profile_slug: slugs[position], title: p.title.trim(), profile_title: p.profileTitle.trim(),
    title_font: p.titleFont, title_color: p.titleColor, title_size: p.titleSize, icon_color: p.iconColor,
    link_text: p.linkText.trim() || null, link_url: p.linkUrl.trim() || null, link_font: p.linkFont, link_color: p.linkColor, has_music: p.hasMusic,
    is_primary: p.isPrimary, page_type: p.pageType, custom_html_url: p.pageType === 'custom_html' ? p.customHtmlUrl : null,
    pair_image_url: p.pairImageUrl,
    // Stripped of any leading © the editor typed themselves — the app
    // always adds its own at render time, so a pasted one would double up.
    illustration_source: p.illustrationSource.trim().replace(/^©\s*/, '') || null,
    illustration_source_font: p.illustrationSourceFont, illustration_source_color: p.illustrationSourceColor,
    background_url: p.backgroundUrl, background_blur: p.backgroundBlur,
    timeline_subtitle_font: p.timelineSubtitleFont, timeline_title_font: p.timelineTitleFont, timeline_text_color: p.timelineTextColor,
    timeline_dot_color: p.timelineDotColor, timeline_line_color: p.timelineLineColor, timeline_shadow: p.timelineShadow,
    position,
  }))
  const { data: insertedProfiles, error: profileErr } = await supabase.from('pair_profiles').insert(profileRows).select('id, position')
  if (profileErr) return profileErr.message

  for (const profileRow of insertedProfiles) {
    const p = profiles[profileRow.position]

    const charRows = p.characters.map((c, i) => ({
      profile_id: profileRow.id, slot: (i + 1) as 1 | 2, name: c.name.trim(), name_color: c.nameColor, name_font: c.nameFont, name_underline_color: c.nameUnderlineColor, profile_image_url: c.profileImageUrl,
      catchphrase: c.catchphrase.trim() || null, catchphrase_color: c.catchphraseColor, catchphrase_font: c.catchphraseFont,
      quote: c.quote.trim() || null, quote_color: c.quoteColor, quote_font: c.quoteFont,
      keyword_1: c.keyword1.trim() || null, keyword_2: c.keyword2.trim() || null, keyword_3: c.keyword3.trim() || null,
      keyword_font: c.keywordFont, keyword_color: c.keywordColor,
      description_color: c.descriptionColor,
      caption_shadow_color: c.captionShadowColor, caption_shadow_strength: c.captionShadowStrength, caption_offset_y: c.captionOffsetY,
      age: c.age.trim() || null, height: c.height.trim() || null, weight: c.weight.trim() || null, job: c.job.trim() || null,
      stats_color: c.statsColor, stats_font: c.statsFont,
    }))
    const { data: insertedProfileChars, error: pcErr } = await supabase.from('profile_characters').insert(charRows).select('id, slot')
    if (pcErr) return pcErr.message

    for (const profileChar of insertedProfileChars) {
      const sections = p.characters[profileChar.slot - 1].sections
      if (!sections.length) continue
      const sectionRows = sections.map((s, pos) => ({
        profile_character_id: profileChar.id, position: pos, title: s.title.trim() || null, title_color: s.titleColor, title_font: s.titleFont,
        description: s.description.trim(), text_color: s.textColor,
      }))
      const { error } = await supabase.from('description_sections').insert(sectionRows)
      if (error) return error.message
    }

    if (p.timelineEntries.length) {
      const entryRows = p.timelineEntries.map((e, pos) => ({
        profile_id: profileRow.id, position: pos, subtitle: e.subtitle.trim() || null, subtitle_color: e.subtitleColor,
        title: e.title.trim() || null, title_color: e.titleColor, description: e.description.trim() || null,
        char1_thought: e.char1Thought.trim() || null, char2_thought: e.char2Thought.trim() || null,
        image_url: e.imageUrl,
      }))
      const { error } = await supabase.from('timeline_entries').insert(entryRows)
      if (error) return error.message
    }
  }
  return null
}
