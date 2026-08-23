import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchCustomHtmlContent, fetchPairWithProfiles } from '@/lib/character-pair-queries'
import { CharacterPairDetail } from '@/components/character-pair-detail'
import { isThemeKey } from '@/lib/themes'
import type { Profile } from '@/types/database'

export default async function CharacterPairPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data as Profile | null
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  const pair = await fetchPairWithProfiles(supabase, slug)
  if (!pair) notFound()

  const activeProfile = pair.pair_profiles.find(p => p.is_primary)
  if (!activeProfile) notFound()

  const customHtmlContent = activeProfile.page_type === 'custom_html' && activeProfile.custom_html_url
    ? await fetchCustomHtmlContent(activeProfile.custom_html_url)
    : null

  // The illustration credit's color is normally a per-pair customization
  // (illustration_source_color, set in the edit form) — Noir overrides
  // it to the theme's point color instead, same as the pair list's own
  // credit tag, without touching what a non-Noir viewer sees.
  const isNoir = isThemeKey(profile?.theme ?? '') && profile!.theme === 'noir'
  const resolvedActiveProfile = isNoir
    ? { ...activeProfile, illustration_source_color: 'var(--theme-accent)' }
    : activeProfile

  return (
    <CharacterPairDetail
      pair={pair}
      profiles={pair.pair_profiles.map(p => ({ profile_slug: p.profile_slug, profile_title: p.profile_title, is_primary: p.is_primary }))}
      activeProfile={resolvedActiveProfile}
      customHtmlContent={customHtmlContent}
      canEdit={canEdit}
    />
  )
}
