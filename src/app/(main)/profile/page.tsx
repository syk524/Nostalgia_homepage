import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CharacterPairGrid } from '@/components/character-pair-grid'
import type { Profile, CharacterPair, Character } from '@/types/database'

export default async function CharacterArchivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data as Profile | null
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  const { data: pairs } = await supabase
    .from('character_pairs')
    .select('*, characters(*)')
    .order('created_at', { ascending: false })

  return (
    // Breaks out of the shared <main>'s centered max-w-5xl — without this,
    // the grid was capped at 1024px and stopped growing on wider screens,
    // which read as "not responsive." sm:pl clears the same side-nav gutter
    // gallery/page.tsx reserves (see that file for why vw, not %), so cards
    // never sit under Nav's floating category rail. animate-fade-up has to
    // stay off this outer div and live on the inner one instead — its
    // keyframe sets `transform: translateY(...)`, which as a plain CSS
    // animation would replace the whole `transform` property and cancel out
    // this div's own -translate-x-1/2 (see character-pair-detail.tsx for
    // the same fix).
    <div className="w-screen relative left-1/2 -translate-x-1/2 px-6 sm:pl-[calc(2.6vw+159px)]">
      <div className="max-w-[1400px] animate-fade-up space-y-6">
        <div className="flex items-start justify-end gap-4">
          {canEdit && <Link href="/profile/new" className="btn-primary shrink-0">New Pair</Link>}
        </div>

        {!pairs?.length && (
          <p className="text-ink-500">No pairs registered yet{canEdit ? ' — register the first one.' : '.'}</p>
        )}

        <CharacterPairGrid pairs={(pairs ?? []) as unknown as (CharacterPair & { characters: Character[] })[]} />
      </div>
    </div>
  )
}
