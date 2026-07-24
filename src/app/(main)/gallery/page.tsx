import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatRelativeTime } from '@/lib/format'
import type { Post, Profile } from '@/types/database'

export default async function GalleryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data as Profile | null
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  const { data: posts } = await supabase
    .from('posts')
    .select('*, author:profiles(*), images:post_images(*)')
    .order('created_at', { ascending: false })

  return (
    <>
      {canEdit && (
        <Link href="/gallery/new" className="btn-primary fixed right-[2.6%] top-[9%] z-20">New Post</Link>
      )}

      <div className="animate-fade-up space-y-8 pt-16">
        {!posts?.length && (
          <p className="text-ink-500">No posts yet{canEdit ? ' — write the first one.' : '.'}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(posts as unknown as (Post & { author: Profile; images: { image_url: string; position: number }[] })[] | null)?.map(post => {
            const thumb = [...(post.images ?? [])].sort((a, b) => a.position - b.position)[0]
            return (
              <Link key={post.id} href={`/gallery/${post.id}`} className="group relative block aspect-[4/3] rounded overflow-hidden shadow-parchment">
                {thumb
                  ? <img src={thumb.image_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                  : <div className="w-full h-full flex items-center justify-center bg-scroll-200 text-scroll-400 text-3xl">◯</div>
                }
                <span className="absolute bottom-2 right-2 text-[10px] font-mono uppercase tracking-wide text-white bg-black/50 rounded px-1.5 py-0.5">
                  {formatRelativeTime(post.created_at)}
                </span>
                <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <h3 className="text-white font-medium truncate">{post.title}</h3>
                  <p className="text-white/70 text-xs font-mono uppercase tracking-wide pt-1">
                    {post.author?.display_name || post.author?.username}
                    {post.is_edited ? ' · edited' : ''}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
