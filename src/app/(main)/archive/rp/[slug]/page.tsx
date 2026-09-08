import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { RpConversation } from '@/components/rp-conversation'
import { ScrollTimeline } from '@/components/scroll-timeline'
import { NoirFloatingParticles } from '@/components/noir-floating-particles'
import { getUserTheme } from '@/lib/get-user-theme'
import type { RpPost } from '@/types/database'

// Same editor-or-admin notFound() gate as the list page (archive/rp/
// page.tsx) — a signed-out or non-editor visitor can't reach an
// individual post directly by URL either, not just via the list.
export default async function RpPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  if (profile?.role !== 'editor' && profile?.role !== 'admin') notFound()
  // Always true here — this page's own gate above already requires
  // editor/admin to view at all — but passed explicitly rather than
  // hardcoding true in RpConversation, so it stays correct if that gate
  // ever loosens later.
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  const { key: theme } = await getUserTheme()
  const { data: post } = await supabase.from('rp_posts').select('*').eq('slug', slug).single()
  if (!post) notFound()
  const typedPost = post as RpPost

  return (
    <>
      {theme === 'noir' && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <NoirFloatingParticles />
        </div>
      )}
      {/* Fixed, icon-only, positioned like the TRPG session detail page's
          own back button (archive/trpg/[slug]/page.tsx) — same left-edge
          rail placement as Nav's own widgets, rather than sitting inline
          in the centered content column, reported directly. */}
      <Link
        href="/archive/rp"
        aria-label="Back to RP"
        className="fixed left-[2.6%] top-[3%] z-[60] inline-flex w-8 h-8 rounded-full items-center justify-start text-ink-400 hover:text-ink noir-accent-color transition-colors"
      >
        <ArrowLeft size={18} />
      </Link>

      {/* Vertically centered in the same left rail as the back button
          above (which sits near the top, top-[3%], so the two don't
          overlap) — a scroll-progress timeline for the log, per direct
          request (reference: section-timeline-preview.framer.website). */}
      <ScrollTimeline containerId="rp-scroll-area" />

      {/* h-screen/overflow-y-auto, not the page's normal document-flow
          scroll — a 650+ message log runs to roughly 90,000px tall, and
          letting the whole document grow to that height stretched the
          shared background grid ((main)/layout.tsx, sized to its own
          containing block) across — and scrolled it along with — that
          entire span instead of it staying put behind the content,
          reported directly (most visible on Sticker, where that grid
          actually shows). Scrolling this one pane internally instead
          keeps the outer page at exactly one viewport tall, so the grid
          never grows past the viewport it was meant to tile in the first
          place.

          -mt-24/-mb-16 cancel *both* of <main>'s own paddings so this
          pane's box spans the full viewport (top: 0 to bottom: 100vh),
          not just the space between them. An earlier version sized the
          box to only the gap between the paddings (h-[calc(100vh-96px)],
          positioned after pt-24) — that box's own top edge sat fixed at
          96px no matter how far the log was scrolled, so the topmost
          message could never reach higher than that: reported directly
          as the log looking clipped a fixed distance below the very top
          of the screen even while scrolling. pt-24/pb-16 on the inner
          content div below reproduce the same *initial* (scrollTop: 0)
          appearance as before — first message still clears the nav by
          the same margin — but because they now live on content inside a
          full-height scrollable box instead of on the box's own
          position, scrolling past them lets later content rise all the
          way to the screen's true top edge instead of stopping short. */}
      <div
        id="rp-scroll-area"
        className="w-screen relative left-1/2 -translate-x-1/2 px-4 min-[1020px]:pr-6 min-[1020px]:pl-[calc(2.6vw+159px)] h-screen -mt-24 -mb-16 overflow-y-auto"
      >
        <div className="animate-fade-up space-y-6 max-w-2xl mx-auto pt-24 pb-16">
          <RpConversation messages={typedPost.messages} postId={typedPost.id} canEdit={canEdit} />
        </div>
      </div>
    </>
  )
}
