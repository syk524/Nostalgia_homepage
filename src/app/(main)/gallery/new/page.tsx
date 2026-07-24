import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NewPostForm } from './new-post-form'

export default async function NewPostPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  if (!canEdit) {
    return (
      <div className="animate-fade-up space-y-2">
        <h2 className="text-3xl text-ink">New Post</h2>
        <p className="text-ink-500">
          You don&apos;t have edit authority yet. <Link href="/gallery" className="text-ember hover:underline">Back to Gallery</Link>
        </p>
      </div>
    )
  }

  return <NewPostForm />
}
