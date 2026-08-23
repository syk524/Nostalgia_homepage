import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { deleteOrphanedImages } from '@/lib/storage-cleanup'

// Plain API route, not a Server Action — see src/app/api/posts/[id]/route.ts
// for why (Server Action revalidation races a client window.location.href).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetched before the delete below cascades away pair_profiles and
  // profile_characters (and this app's only record of what they used to
  // reference) — every image this pair used is unambiguously orphaned
  // once the pair itself is gone, same reasoning as trpg.ts's own
  // deleteSession.
  const { data: oldProfiles } = await supabase
    .from('pair_profiles')
    .select('id, pair_image_url, background_url')
    .eq('pair_id', id)
  const oldProfileIds = (oldProfiles ?? []).map(p => p.id)
  const { data: oldChars } = oldProfileIds.length
    ? await supabase.from('profile_characters').select('profile_image_url').in('profile_id', oldProfileIds)
    : { data: [] as { profile_image_url: string | null }[] }
  const { data: oldEntries } = oldProfileIds.length
    ? await supabase.from('timeline_entries').select('image_url').in('profile_id', oldProfileIds)
    : { data: [] as { image_url: string | null }[] }

  const { data: deleted, error } = await supabase.from('character_pairs').delete().eq('id', id).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!deleted?.length) return NextResponse.json({ error: 'You don’t have permission to delete this pair.' }, { status: 403 })

  await deleteOrphanedImages(
    supabase,
    [
      ...(oldProfiles ?? []).flatMap(p => [p.pair_image_url, p.background_url]),
      ...(oldChars ?? []).map(c => c.profile_image_url),
      ...(oldEntries ?? []).map(e => e.image_url),
    ],
    [],
  )

  revalidatePath('/profile')
  return NextResponse.json({ success: true })
}
