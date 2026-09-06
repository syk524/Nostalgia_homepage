import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArchiveSectionTabs } from '@/components/archive-side-nav'
import { NoirFloatingParticles } from '@/components/noir-floating-particles'
import { RpDeck, type ListedRpPost } from '@/components/rp-deck'
import { getUserTheme } from '@/lib/get-user-theme'

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
    .select('id, title, messages')
    .order('created_at', { ascending: true })

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
            <RpDeck posts={posts} />
          )}
        </div>
      </div>
    </>
  )
}
