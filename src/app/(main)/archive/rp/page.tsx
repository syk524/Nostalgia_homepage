import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { ArchiveSectionTabs } from '@/components/archive-side-nav'
import { NoirFloatingParticles } from '@/components/noir-floating-particles'
import { getUserTheme } from '@/lib/get-user-theme'
import type { RpPost } from '@/types/database'

type ListedPost = Pick<RpPost, 'id' | 'title' | 'cover_url'>

// Thumbnail + title card, matching TRPG's own SessionCard treatment
// (archive/trpg/page.tsx) — reported directly, in favor of the earlier
// plain text row. No date/description row under the title the way
// SessionCard has — an RP post has neither, and the date was dropped
// from here on request rather than just having nothing to show.
function PostCard({ post }: { post: ListedPost }) {
  return (
    <Link href={`/archive/rp/${post.id}`} className="group block">
      <div className="relative w-full aspect-[3/4] transition-all duration-200 overflow-hidden rounded bg-scroll-100 group-hover:-translate-y-1">
        {post.cover_url ? (
          <Image src={post.cover_url} alt="" fill sizes="(min-width: 1020px) 25vw, 50vw" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-scroll-300 text-scroll-400 text-3xl">◯</div>
        )}
      </div>
      <p
        className="mt-3 text-center text-[15px] tracking-[0.02em] truncate w-full"
        style={{ fontFamily: 'var(--font-chosun-nm), Georgia, serif', color: 'var(--theme-accent)' }}
      >
        {post.title}
      </p>
    </Link>
  )
}

// Editor-or-admin-only to view at all, same notFound() gate as
// archive/memo/page.tsx and archive/links/page.tsx — not a public
// archive section like /archive/trpg. The rail itself (ArchiveSideNav)
// is already gated the same way in archive/layout.tsx, so this is what
// stops a guest from reaching the page directly by URL too.
export default async function ArchiveRpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  if (profile?.role !== 'editor' && profile?.role !== 'admin') notFound()

  const { key: theme } = await getUserTheme()
  const { data: posts } = await supabase
    .from('rp_posts')
    .select('id, title, cover_url')
    .order('created_at', { ascending: false })

  return (
    <>
      {theme === 'noir' && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <NoirFloatingParticles />
        </div>
      )}
      <div className="w-screen relative left-1/2 -translate-x-1/2 px-4 min-[1020px]:pr-6 min-[1020px]:pl-[calc(2.6vw+159px)]">
        <div className="animate-fade-up space-y-8">
          <ArchiveSectionTabs />

          {!posts?.length ? (
            <p className="text-sm text-ink-400 noir-accent-color">No RP logs yet.</p>
          ) : (
            <div className="grid grid-cols-2 min-[1020px]:grid-cols-4 gap-x-4 gap-y-6 min-[1020px]:gap-x-8 min-[1020px]:gap-y-12">
              {(posts as ListedPost[]).map(post => <PostCard key={post.id} post={post} />)}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
