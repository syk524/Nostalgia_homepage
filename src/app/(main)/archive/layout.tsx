import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArchiveSideNav } from '@/components/archive-side-nav'

// Centralizes the admin-only gate that used to live inline in
// archive/page.tsx — every route under /archive/* (trpg, links, and
// whatever each of those add underneath) inherits this for free instead
// of repeating the same profile-role check per page.
export default async function ArchiveLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null

  if (profile?.role !== 'admin') notFound()

  return (
    <>
      <ArchiveSideNav />
      {children}
    </>
  )
}
