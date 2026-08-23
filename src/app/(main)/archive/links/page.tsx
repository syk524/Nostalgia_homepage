import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Placeholder — the Links section (see ArchiveSideNav) has no content yet.
// Editor-or-admin-only to VIEW at all, not just to edit — reported
// directly, unlike /archive/trpg which stays public. Same flat 404 as
// archive/trpg/new/page.tsx (not a "log in first" redirect), so a guest
// poking at the URL directly can't tell this route exists.
export default async function ArchiveLinksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  if (profile?.role !== 'editor' && profile?.role !== 'admin') notFound()

  return null
}
