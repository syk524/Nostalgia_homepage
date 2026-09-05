'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireEditor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: 'You must be signed in.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'editor' && profile?.role !== 'admin') {
    return { supabase, user: null, error: 'You don’t have edit authority for the memo board.' }
  }
  return { supabase, user, error: null }
}

export async function createMemo(memo: { content: string; imageUrl: string | null; storagePath: string | null }) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { memo: null, error: authError }

  // New memo always lands first (right after the New Memo pad, which
  // isn't itself a row here — it's position-less UI) — reported directly.
  // One below the current lowest position rather than reassigning
  // everyone else's, same reasoning reorderMemos avoids for the opposite
  // end. Two editors' min-position reads racing is a real but low-stakes
  // possibility (a board this small, added to one at a time in
  // practice); worth a follow-up sequence/column default only if it ever
  // actually collides.
  const { data: first } = await supabase.from('memos').select('position').order('position', { ascending: true }).limit(1).maybeSingle()
  const position = (first?.position ?? 1) - 1

  const { data: saved, error } = await supabase
    .from('memos')
    .insert({
      author_id: user.id,
      content: memo.content,
      image_url: memo.imageUrl,
      storage_path: memo.storagePath,
      position,
    })
    .select('*')
    .single()

  if (error || !saved) return { memo: null, error: error?.message ?? 'Could not add the memo.' }
  revalidatePath('/archive/memo')
  return { memo: saved, error: null }
}

// Drag-to-reorder commit, fired once on drop — matches the rest of this
// file's save-on-release convention rather than writing on every
// live-shuffle step during the drag itself.
export async function reorderMemos(orderedIds: string[]) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { error: authError }

  const { error } = await Promise.all(
    orderedIds.map((id, position) => supabase.from('memos').update({ position }).eq('id', id))
  ).then(results => ({ error: results.find(r => r.error)?.error ?? null }))

  if (error) return { error: error.message }
  revalidatePath('/archive/memo')
  return { error: null }
}

export async function updateMemoContent(id: string, content: string) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { error: authError }

  const { error } = await supabase.from('memos').update({ content }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/archive/memo')
  return { error: null }
}

export async function deleteMemo(id: string, storagePath: string | null) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { error: authError }

  const { data: deleted, error } = await supabase.from('memos').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!deleted?.length) return { error: 'You don’t have permission to remove this memo.' }

  if (storagePath) await supabase.storage.from('memo-images').remove([storagePath])
  revalidatePath('/archive/memo')
  return { error: null }
}
