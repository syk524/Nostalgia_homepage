import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArchiveSectionTabs } from '@/components/archive-side-nav'

// Editor-or-admin-only to view at all, same notFound() gate as
// archive/links/page.tsx — not a public archive section like
// /archive/trpg. The rail itself (ArchiveSideNav) is already gated the
// same way in archive/layout.tsx, so this is what stops a guest from
// reaching the page directly by URL too. Blank for now — no content
// built yet.
export default async function ArchiveMemoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  if (profile?.role !== 'editor' && profile?.role !== 'admin') notFound()

  return (
    <div className="w-screen relative left-1/2 -translate-x-1/2 px-4 min-[1020px]:pr-6 min-[1020px]:pl-[calc(2.6vw+159px)]">
      <div className="animate-fade-up space-y-8">
        <ArchiveSectionTabs />
      </div>
    </div>
  )
}
