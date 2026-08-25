import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchPairWithProfiles } from '@/lib/character-pair-queries'
import { CharacterPairForm } from '@/components/character-pair-form'

export default async function EditCharacterPairPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ profile?: string }> }) {
  const { slug } = await params
  const { profile: activeProfileSlug } = await searchParams
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
    <div className="max-w-2xl space-y-6 mx-auto">
      {/* Not animate-fade-up on this wrapper — see profile/new/page.tsx's
          matching comment: its `to` keyframe leaves a permanent
          transform: translateY(0), which breaks CharacterPairForm's own
          fixed-position SectionNav by making this div its containing
          block instead of the viewport. */}
      <h2 className="text-3xl text-ink noir-accent-color animate-fade-up">페어 편집</h2>
      <CharacterPairForm initialData={{ pair }} initialActiveProfileSlug={activeProfileSlug} />
    </div>
  )
}
