import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { RpConversation } from '@/components/rp-conversation'
import { NoirFloatingParticles } from '@/components/noir-floating-particles'
import { getUserTheme } from '@/lib/get-user-theme'
import type { RpPost } from '@/types/database'

// Same editor-or-admin notFound() gate as the list page (archive/rp/
// page.tsx) — a signed-out or non-editor visitor can't reach an
// individual post directly by URL either, not just via the list.
export default async function RpPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  if (profile?.role !== 'editor' && profile?.role !== 'admin') notFound()

  const { key: theme } = await getUserTheme()
  const { data: post } = await supabase.from('rp_posts').select('*').eq('id', id).single()
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

      <div className="w-screen relative left-1/2 -translate-x-1/2 px-4 min-[1020px]:pr-6 min-[1020px]:pl-[calc(2.6vw+159px)] pb-16">
        <div className="animate-fade-up space-y-6 max-w-2xl mx-auto">
          <RpConversation messages={typedPost.messages} />
        </div>
      </div>
    </>
  )
}
