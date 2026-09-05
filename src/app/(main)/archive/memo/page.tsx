import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArchiveSectionTabs } from '@/components/archive-side-nav'
import { MemoBoard } from '@/components/memo-board'
import { NoirFloatingParticles } from '@/components/noir-floating-particles'
import { getUserTheme } from '@/lib/get-user-theme'
import type { Memo } from '@/types/database'

// Editor-or-admin-only to view at all, same notFound() gate as
// archive/links/page.tsx — not a public archive section like
// /archive/trpg. The rail itself (ArchiveSideNav) is already gated the
// same way in archive/layout.tsx, so this is what stops a guest from
// reaching the page directly by URL too.
export default async function ArchiveMemoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  if (profile?.role !== 'editor' && profile?.role !== 'admin') notFound()

  const { key: theme } = await getUserTheme()
  const { data: memos } = await supabase.from('memos').select('*').order('position', { ascending: true })

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
          <MemoBoard initialMemos={(memos as Memo[] | null) ?? []} userId={user!.id} />
        </div>
      </div>
    </>
  )
}
