import { createClient } from '@/lib/supabase/server'
import { ArchiveSideNav } from '@/components/archive-side-nav'

// Viewing /archive/trpg is open to everyone, matching Gallery/Profile —
// reported directly. /archive/links is not: it's editor-or-admin-only to
// view at all now (see that page's own notFound() gate), so this layout
// can't gate access centrally any more even though it once could when
// every /archive/* route shared the same public-viewing policy.
// create/edit/delete on trpg stay editor-or-admin-only too, enforced
// where each of those actually happens (trpg/new/page.tsx,
// [slug]/edit/page.tsx, the canEdit checks in [slug]/page.tsx and
// trpg/page.tsx) plus RLS underneath.
export default async function ArchiveLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  return (
    <>
      {/* Editor-or-admin, not admin-only any more — reported directly.
          The rail itself is just navigation between TRPG (public to view)
          and Links (not); showing it to editors too matches Links' own
          access level now instead of being one notch stricter than it. */}
      {canEdit && <ArchiveSideNav />}
      {children}
    </>
  )
}
