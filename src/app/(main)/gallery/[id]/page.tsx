import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/format'
import type { Post, Profile, PostImage } from '@/types/database'
import { DeletePostButton } from './delete-button'
import { ImageCarousel } from '@/components/image-carousel'

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data as Profile | null
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  const { data: post } = await supabase
    .from('posts')
    .select('*, author:profiles(*), images:post_images(*)')
    .eq('id', id)
    .single()

  if (!post) notFound()

  const typedPost = post as unknown as Post & { author: Profile; images: PostImage[] }
  const images = [...(typedPost.images ?? [])].sort((a, b) => a.position - b.position)

  return (
    <article className="animate-fade-up max-w-2xl space-y-6">
      <Link href="/gallery" className="text-sm text-ink-500 hover:text-ink transition-colors">← Back to Gallery</Link>

      <div>
        <h1 className="text-3xl text-ink">{typedPost.title}</h1>
        <p className="text-ink-500 text-sm mt-2 font-mono uppercase tracking-wide">
          {typedPost.author?.display_name || typedPost.author?.username} · {formatDate(typedPost.created_at)}
          {typedPost.is_edited ? ' · edited' : ''}
        </p>
      </div>

      <ImageCarousel images={images} />

      <p className="text-ink whitespace-pre-wrap leading-relaxed">{typedPost.body}</p>

      {canEdit && (
        <div className="flex gap-2 pt-4 border-t border-scroll-300">
          <Link href={`/gallery/${typedPost.id}/edit`} className="btn-ghost">Edit</Link>
          <DeletePostButton postId={typedPost.id} />
        </div>
      )}
    </article>
  )
}
