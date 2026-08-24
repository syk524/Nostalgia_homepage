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
        <h2 className="text-3xl text-ink">페어 편집</h2>
        <p className="text-ink-500">
          아직 편집 권한이 없습니다. <Link href={`/profile/${slug}`} className="text-ember hover:underline">페어로 돌아가기</Link>
        </p>
      </div>
    )
  }

  const pair = await fetchPairWithProfiles(supabase, slug)
  if (!pair) notFound()

  return (
    <div className="animate-fade-up max-w-[1400px] space-y-6 mx-auto">
      <h2 className="text-3xl text-ink">페어 편집</h2>
      <CharacterPairForm initialData={{ pair }} />
    </div>
  )
}
