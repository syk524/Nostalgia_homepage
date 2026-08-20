import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NewPostForm } from './new-post-form'

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category: categoryName } = await searchParams
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

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  // Reached from the "+" tile on a filtered gallery view (?category=<name>,
  // matching the URL convention gallery/page.tsx's own category links
  // already use) — an unknown/stale name just falls back to no
  // pre-selection rather than erroring.
  const initialCategoryId = categoryName
    ? (categories ?? []).find(c => c.name === categoryName)?.id ?? null
    : null

  return <NewPostForm categories={categories ?? []} initialCategoryId={initialCategoryId} />
}
