import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CharacterPairForm } from '@/components/character-pair-form'

export default async function NewCharacterPairPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  if (!canEdit) {
    return (
      <div className="animate-fade-up space-y-2">
        <h2 className="text-3xl text-ink">새 페어 만들기</h2>
        <p className="text-ink-500">
          아직 편집 권한이 없습니다. <Link href="/profile" className="text-ember hover:underline">프로필로 돌아가기</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6 mx-auto">
      {/* Not animate-fade-up on this wrapper — its `to` keyframe leaves a
          permanent transform: translateY(0), which makes this div a
          containing block for any position:fixed descendant (CSS spec),
          silently breaking CharacterPairForm's own fixed SectionNav (it'd
          resolve against this narrow max-w-2xl box instead of the
          viewport) — same class of bug character-pair-detail.tsx hit with
          its own side nav. animate-fade-up moves down onto the pieces
          that actually need to animate instead. */}
      <h2 className="text-3xl text-ink animate-fade-up">새 페어 만들기</h2>
      <CharacterPairForm />
    </div>
  )
}
