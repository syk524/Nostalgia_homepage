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
    <div className="animate-fade-up max-w-[1400px] space-y-6 mx-auto">
      <h2 className="text-3xl text-ink">New Pair</h2>
      <CharacterPairForm />
    </div>
  )
}
