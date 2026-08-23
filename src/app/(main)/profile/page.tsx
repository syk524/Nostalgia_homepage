import { createClient } from '@/lib/supabase/server'
import { CharacterPairGrid } from '@/components/character-pair-grid'
import type { Profile, CharacterPair, PairProfile, ProfileCharacter } from '@/types/database'

export default async function CharacterArchivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data as Profile | null
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  // pair_profiles/profile_characters are locked to signed-in reads only
  // (see migration 052) — a guest can't query them directly, so the
  // grid goes through this security-definer RPC instead, which returns
  // only the summary fields below regardless of who's asking. Shape
  // matches PrimaryProfileSummary exactly, so nothing downstream
  // (CharacterPairGrid) needs to change.
  const { data: rawPairs } = await supabase.rpc('get_public_pair_grid')
  type PrimaryProfileSummary = Pick<PairProfile, 'title' | 'title_font' | 'pair_image_url' | 'illustration_source' | 'background_url'> & { profile_characters: Pick<ProfileCharacter, 'name' | 'name_color' | 'name_font' | 'slot'>[] }
  const pairs = rawPairs as unknown as (CharacterPair & { pair_profiles: PrimaryProfileSummary[] })[] | null

  return (
    // Breaks out of the shared <main>'s centered max-w-5xl — without this,
    // the grid was capped at 1024px and stopped growing on wider screens,
    // which read as "not responsive." min-[1020px]:pl clears the same
    // side-nav gutter gallery/page.tsx reserves (see that file for why vw,
    // not %), so cards never sit under Nav's floating category rail —
    // 1020px, this site's own mobile/desktop breakpoint, not Tailwind's
    // default sm: (640px); below it there's no gutter at all any more,
    // reported directly, since nothing actually occupies that space on
    // this page below the breakpoint either. animate-fade-up has to stay
    // off this outer div and live on the inner one instead — its keyframe
    // sets `transform: translateY(...)`, which as a plain CSS animation
    // would replace the whole `transform` property and cancel out this
    // div's own -translate-x-1/2 (see character-pair-detail.tsx for the
    // same fix). No max-width on the inner div either — it now fills the
    // full viewport width at any screen size; only each card's own pair
    // image keeps its own max-w-[600px] cap (character-pair-grid.tsx), so
    // the background/grid scales freely while the artwork itself doesn't
    // blow up past a sane size.
    <div className="w-screen relative left-1/2 -translate-x-1/2 px-6 min-[1020px]:pl-[calc(2.6vw+159px)]">
      <div className="animate-fade-up space-y-6">
        {!pairs?.length && !canEdit && (
          <p className="text-ink-500">No pairs registered yet.</p>
        )}

        <CharacterPairGrid pairs={pairs ?? []} canEdit={canEdit} />
      </div>
    </div>
  )
}
