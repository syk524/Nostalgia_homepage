import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArchiveSideNav } from '@/components/archive-side-nav'

// Centralizes the editor-or-admin gate that used to live inline in
// archive/page.tsx — every route under /archive/* (trpg, links, and
// whatever each of those add underneath) inherits this for free instead
// of repeating the same profile-role check per page. Widened from
// admin-only (this app's first role='admin'-only section) to match the
// editor/admin split used everywhere else — reported directly. Middleware
// deliberately passes /archive/* straight through instead of redirecting
// guests to login (see its own comment), so this notFound() is the ONLY
// enforcement: same flat 404 whether the request is a guest, a logged-in
// viewer, or someone who typed the URL directly, never a distinguishing
// "log in first" redirect that would leak that the route exists at all.
export default async function ArchiveLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  const isAdmin = profile?.role === 'admin'
  const canAccess = isAdmin || profile?.role === 'editor'

  if (!canAccess) notFound()

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
