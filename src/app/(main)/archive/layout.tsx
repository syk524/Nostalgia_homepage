import { createClient } from '@/lib/supabase/server'
import { ArchiveSideNav } from '@/components/archive-side-nav'

// Viewing every route under /archive/* (trpg, links, and whatever each of
// those add underneath) is open to everyone now, matching Gallery/Profile
// — reported directly. There's no access gate here at all any more;
// create/edit/delete stay editor-or-admin-only, but that's enforced where
// each of those actually happens (trpg/new/page.tsx, [slug]/edit/page.tsx,
// the canEdit checks in [slug]/page.tsx and trpg/page.tsx) plus RLS
// underneath, not centrally here.
export default async function ArchiveLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  const isAdmin = profile?.role === 'admin'

  return (
    <>
      {/* Editor/admin split, not just canAccess — reported directly: an
          editor should be able to reach every /archive/* page, but the
          TRPG/Links side rail itself stays admin-only. */}
      {isAdmin && <ArchiveSideNav />}
      {children}
    </>
  )
}
