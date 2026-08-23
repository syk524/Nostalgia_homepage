import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LinksArchiveView } from '@/components/links-archive-view'
import type { ArchiveLink } from '@/types/database'

// Editor-or-admin-only to VIEW at all, not just to edit — reported
// directly, unlike /archive/trpg which stays public. Same flat 404 as
// archive/trpg/new/page.tsx (not a "log in first" redirect), so a guest
// poking at the URL directly can't tell this route exists. RLS on
// archive_links (072_archive_links.sql) enforces the same split
// underneath regardless, but the notFound() here is what keeps a guest
// from even seeing the page shell load.
export default async function ArchiveLinksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  if (profile?.role !== 'editor' && profile?.role !== 'admin') notFound()

  const { data: links } = await supabase
    .from('archive_links')
    .select('*')
    .order('position', { ascending: true })

  return <LinksArchiveView links={(links ?? []) as ArchiveLink[]} />
}
