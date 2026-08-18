import { createClient } from '@/lib/supabase/server'
import type { CharacterPair, PairProfile, ProfileCharacter } from '@/types/database'

// Omit + re-add, not a plain intersection — CharacterPair/PairProfile
// already declare their nested-content fields as optional, and
// intersecting an optional field with a required one doesn't simplify
// away the original, wider member.
export type PairProfileWithContent = Omit<PairProfile, 'profile_characters'> & { profile_characters: ProfileCharacter[] }
export type CharacterPairWithProfiles = Omit<CharacterPair, 'pair_profiles'> & { pair_profiles: PairProfileWithContent[] }

// Shared by both /profile/[slug] (renders the primary profile) and
// /profile/[slug]/[profileSlug] (renders any other one) — same fetch and
// sort either way, just a different pick of which pair_profiles row is
// "active" afterward.
export async function fetchPairWithProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<CharacterPairWithProfiles | null> {
  const { data: pair } = await supabase
    .from('character_pairs')
    .select('*, pair_profiles(*, profile_characters(*, description_sections(*)), timeline_entries(*))')
    .eq('slug', slug)
    .single()

  if (!pair) return null

  const typedPair = pair as unknown as CharacterPairWithProfiles
  // Supabase doesn't support ordering a doubly/triply-nested embed inline
  // — see profile/page.tsx for the same fix, one level deeper here.
  typedPair.pair_profiles.forEach(p => {
    p.profile_characters.sort((a, b) => a.slot - b.slot)
    p.profile_characters.forEach(pc => pc.description_sections?.sort((a, b) => a.position - b.position))
    p.timeline_entries?.sort((a, b) => a.position - b.position)
  })
  typedPair.pair_profiles.sort((a, b) => a.position - b.position)

  return typedPair
}

// Supabase Storage always serves .html objects as text/plain (a fixed
// security policy, not a per-bucket setting — see custom-html-profile-view.tsx),
// so the only way to actually render an uploaded page is to fetch its raw
// text ourselves and hand that string to the iframe via srcDoc instead of
// pointing src at the URL directly. Null on any failure (deleted file,
// network hiccup) — the view falls back to a plain "couldn't load" message.
export async function fetchCustomHtmlContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}
