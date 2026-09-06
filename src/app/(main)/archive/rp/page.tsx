import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArchiveSectionTabs } from '@/components/archive-side-nav'
import { NoirFloatingParticles } from '@/components/noir-floating-particles'
// The rolling-chat-log deck (rp-deck.tsx/rp-thumbnail-preview.tsx) is
// kept in the codebase unused rather than deleted — per direct request,
// in case the postcard version below doesn't work out. Swap this import
// back to '@/components/rp-deck' (and ListedRpPost's own source with it)
// to restore it.
import { RpPostcardDeck as RpDeck, type ListedRpPost } from '@/components/rp-postcard-deck'
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
        {/* Below 520px, RpPostcardDeck shows a bare stamp with a big gap
            of empty page beneath it (the deck's own content is far
            shorter than the mobile viewport) — reported directly. The
            10rem in min-h matches <main>'s own pt-24 + pb-16 (layout.tsx),
            so this column reserves the full visible height below the nav,
            and flex-1 on the deck's wrapper lets it soak up the leftover
            space and center itself in it, instead of sitting top-aligned
            with everything else crammed underneath. Untouched at
            min-[520px] and up — desktop's layout already reads fine
            top-aligned. */}
        <div className="animate-fade-up space-y-8 max-[519px]:flex max-[519px]:flex-col max-[519px]:min-h-[calc(100dvh-10rem)]">
          <ArchiveSectionTabs />

          {!posts?.length ? (
            <p className="text-sm text-ink-400 noir-accent-color">No RP logs yet.</p>
          ) : (
            <div className="max-[519px]:flex-1 max-[519px]:flex max-[519px]:min-h-0 max-[519px]:items-center max-[519px]:justify-center">
              <RpDeck posts={posts} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
