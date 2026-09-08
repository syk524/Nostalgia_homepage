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
    .select('id, title, slug, messages')
    .order('created_at', { ascending: true })

  return (
    <>
      {theme === 'noir' && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <NoirFloatingParticles />
        </div>
      )}
      <div className="w-screen relative left-1/2 -translate-x-1/2 px-4 min-[1020px]:pr-6 min-[1020px]:pl-[calc(2.6vw+159px)]">
        {/* Reserves the full visible height below the nav (10rem matches
            <main>'s own pt-24 + pb-16 in layout.tsx) and centers the deck
            in whatever's left over, rather than sitting top-aligned with
            a big gap of empty page beneath it on a tall viewport —
            reported directly. Originally scoped to below-520px only (the
            deck's own content is far shorter than a mobile viewport), but
            the same gap shows up on any tall-enough desktop window too,
            so this now applies at every width. Purely a floor, not a
            cap — on a viewport short enough (or a log long enough) that
            the deck's own content exceeds this height, flex just grows
            the column past it and nothing visibly centers, same as
            ordinary block stacking would. */}
        <div className="animate-fade-up space-y-8 flex flex-col min-h-[calc(100dvh-10rem)]">
          <ArchiveSectionTabs />

          {!posts?.length ? (
            <p className="text-sm text-ink-400 noir-accent-color">No RP logs yet.</p>
          ) : (
            <div className="flex-1 flex min-h-0 items-center justify-center">
              <RpDeck posts={posts} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
