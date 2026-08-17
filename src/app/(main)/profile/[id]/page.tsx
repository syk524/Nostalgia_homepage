import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CharacterPairDetail } from '@/components/character-pair-detail'
import type { Profile, CharacterPair, Character } from '@/types/database'

export default async function CharacterPairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data as Profile | null
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  const { data: pair } = await supabase
    .from('character_pairs')
    .select('*, characters(*)')
    .eq('id', id)
    .single()

  if (!pair) notFound()

  const typedPair = pair as unknown as CharacterPair & { characters: Character[] }

  return <CharacterPairDetail pair={typedPair} canEdit={canEdit} />
}
