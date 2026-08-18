import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchPairWithProfiles } from '@/lib/character-pair-queries'
import { CharacterPairForm } from '@/components/character-pair-form'

export default async function EditCharacterPairPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
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
          You don&apos;t have edit authority yet. <Link href={`/profile/${slug}`} className="text-ember hover:underline">Back to pair</Link>
        </p>
      </div>
    )
  }

  const pair = await fetchPairWithProfiles(supabase, slug)
  if (!pair) notFound()

  return (
    <div className="animate-fade-up max-w-2xl space-y-6 mx-auto">
      <h2 className="text-3xl text-ink">Edit Pair</h2>
      <CharacterPairForm initialData={{ pair }} />
    </div>
  )
}
