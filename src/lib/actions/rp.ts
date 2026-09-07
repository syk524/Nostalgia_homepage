'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { RpMessage } from '@/types/database'

async function requireEditor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: 'You must be signed in.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'editor' && profile?.role !== 'admin') {
    return { supabase, user: null, error: 'You don’t have edit authority for the RP archive.' }
  }
  return { supabase, user, error: null }
}

// Messages live as one JSON array on the post row, not a per-message
// table (097's own migration comment: nothing was expected to edit an
// individual message independently of its post) — so there's no
// per-message id to update directly. This reads the array, replaces one
// entry's html by its index, and writes the whole array back. Index-based
// rather than diffing/merging concurrent edits — fine at this app's
// scale (a couple of editors), same tolerance as reorderMemos' own
// documented race in lib/actions/memo.ts.
export async function updateRpMessage(postId: string, index: number, html: string) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { error: authError }

  const { data: post, error: fetchError } = await supabase
    .from('rp_posts')
    .select('messages')
    .eq('id', postId)
    .single()
  if (fetchError || !post) return { error: fetchError?.message ?? 'Post not found.' }

  const messages = post.messages as RpMessage[]
  if (!messages[index]) return { error: 'Message not found.' }

  const updated = messages.map((m, i) => (i === index ? { ...m, html } : m))
  const { error } = await supabase.from('rp_posts').update({ messages: updated }).eq('id', postId)
  if (error) return { error: error.message }

  revalidatePath(`/archive/rp/${postId}`)
  return { error: null }
}
