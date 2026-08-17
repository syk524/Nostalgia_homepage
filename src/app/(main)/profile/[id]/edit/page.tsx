import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CharacterPairForm } from '@/components/character-pair-form'
import type { CharacterPair, Character } from '@/types/database'

export default async function EditCharacterPairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  if (!canEdit) {
    return (
      <div className="animate-fade-up space-y-2">
        <h2 className="text-3xl text-ink">Edit Pair</h2>
        <p className="text-ink-500">
          You don&apos;t have edit authority yet. <Link href={`/profile/${id}`} className="text-ember hover:underline">Back to pair</Link>
        </p>
      </div>
    )
  }

  const { data: pair } = await supabase
    .from('character_pairs')
    .select('*, characters(*)')
    .eq('id', id)
    .single()

  if (!pair) notFound()

  const typedPair = pair as unknown as CharacterPair & { characters: Character[] }
  const sorted = [...typedPair.characters].sort((a, b) => a.slot - b.slot) as [Character, Character]

  return (
    <div className="animate-fade-up max-w-2xl space-y-6 mx-auto">
      <h2 className="text-3xl text-ink">Edit Pair</h2>
      <CharacterPairForm initialData={{ pair: typedPair, characters: sorted }} />
    </div>
  )
}
