import { createClient } from '@/lib/supabase/server'
import type { Post, Profile, PostImage, Category } from '@/types/database'

export type FullPost = Post & { author: Profile; images: PostImage[]; category: Category }

// Shared by both the intercepted modal route and its plain-page fallback —
// the two now render identical UI (PostModal), so there's no "full page"
// design to keep in sync separately.
export async function getPostDetail(id: string) {
  const supabase = await createClient()

  // post doesn't depend on the user/profile at all (only on `id`), so it
  // runs alongside getUser() instead of waiting behind it — profile
  // genuinely does need user.id first, but that's the only real
  // dependency left once post is out of that chain.
  const [{ data: { user } }, { data: post }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('posts').select('*, author:profiles(*), images:post_images(*), category:categories(*)').eq('id', id).single(),
  ])

  if (!post) return null
  const typedPost = post as unknown as FullPost

  const [{ data: profile }, { data: prevPost }, { data: nextPost }] = await Promise.all([
    user
      ? supabase.from('profiles').select('*').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from('posts').select('id').lt('position', typedPost.position).order('position', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('posts').select('id').gt('position', typedPost.position).order('position', { ascending: true }).limit(1).maybeSingle(),
  ])
  const canEdit = (profile as Profile | null)?.role === 'editor' || (profile as Profile | null)?.role === 'admin'

  return { post: typedPost, canEdit, prevId: prevPost?.id as string | undefined, nextId: nextPost?.id as string | undefined }
}
