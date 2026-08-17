import { createClient } from '@/lib/supabase/server'
import type { Post, Profile, PostImage, Category } from '@/types/database'

export type FullPost = Post & { author: Profile; images: PostImage[]; category: Category }

// Shared by both the intercepted modal route and its plain-page fallback —
// the two now render identical UI (PostModal), so there's no "full page"
// design to keep in sync separately.
export async function getPostDetail(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data as Profile | null
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  const { data: post } = await supabase
    .from('posts')
    .select('*, author:profiles(*), images:post_images(*), category:categories(*)')
    .eq('id', id)
    .single()

  if (!post) return null

  const typedPost = post as unknown as FullPost

  const [{ data: prevPost }, { data: nextPost }] = await Promise.all([
    supabase.from('posts').select('id').lt('position', typedPost.position).order('position', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('posts').select('id').gt('position', typedPost.position).order('position', { ascending: true }).limit(1).maybeSingle(),
  ])

  return { post: typedPost, canEdit, prevId: prevPost?.id as string | undefined, nextId: nextPost?.id as string | undefined }
}
