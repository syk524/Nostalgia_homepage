import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EditPostForm } from './edit-post-form'

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
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
        <h2 className="text-3xl text-ink">Edit Post</h2>
        <p className="text-ink-500">
          You don&apos;t have edit authority yet. <Link href={`/gallery/${id}`} className="text-ember hover:underline">Back to post</Link>
        </p>
      </div>
    )
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  return <EditPostForm postId={id} categories={categories ?? []} />
}
