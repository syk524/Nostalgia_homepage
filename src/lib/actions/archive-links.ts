'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// New links land at the TOP of the list — position is just "insertion
// order" here (no drag-reorder UI yet, unlike posts' own reorderPosts),
// and the list itself is fetched ascending by position (see
// archive/links/page.tsx), so the simplest correct value is one below
// whatever the lowest position currently is.
export async function createLink(title: string, url: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!title.trim()) return { error: 'Title is required.' }
  if (!url.trim()) return { error: 'URL is required.' }

  const { data: first } = await supabase
    .from('archive_links')
    .select('position')
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  const position = (first?.position ?? 1) - 1

  // Returns the whole row (not just id) — the caller keeps its own local
  // copy of the list for instant UI feedback (see links-archive-view.tsx)
  // rather than waiting on a server round trip to re-render, so it needs
  // every field to append client-side, not just the new id.
  const { data: link, error } = await supabase
    .from('archive_links')
    .insert({ title: title.trim(), url: url.trim(), position })
    .select('*')
    .single()

  if (error || !link) return { error: error?.message ?? 'Could not add the link.' }

  revalidatePath('/archive/links')
  return { success: true, link }
}

export async function deleteLink(linkId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { error } = await supabase.from('archive_links').delete().eq('id', linkId)
  if (error) return { error: error.message }

  revalidatePath('/archive/links')
  return { success: true }
}
