'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createSession(title: string, body: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!title.trim()) return { error: 'Title is required.' }

  const { data: session, error } = await supabase
    .from('trpg_sessions')
    .insert({ title: title.trim(), body, created_by: user.id })
    .select('id')
    .single()

  if (error || !session) return { error: error?.message ?? 'Could not create the session.' }

  revalidatePath('/archive/trpg')
  return { sessionId: session.id, error: null }
}

export async function updateSession(sessionId: string, title: string, body: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!title.trim()) return { error: 'Title is required.' }

  const { data: updated, error } = await supabase
    .from('trpg_sessions')
    .update({ title: title.trim(), body })
    .eq('id', sessionId)
    .select('id')

  if (error) return { error: error.message }
  // RLS silently filters rows it denies (no Postgres error) rather than
  // rejecting the request, so an empty result means "not allowed," not
  // "nothing to update" — same reasoning as updatePost (gallery.ts).
  if (!updated?.length) return { error: 'You don’t have permission to edit this session.' }

  revalidatePath('/archive/trpg')
  revalidatePath(`/archive/trpg/${sessionId}`)
  return { sessionId, error: null }
}

export async function deleteSession(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { data: deleted, error } = await supabase
    .from('trpg_sessions')
    .delete()
    .eq('id', sessionId)
    .select('id')

  if (error) return { error: error.message }
  if (!deleted?.length) return { error: 'You don’t have permission to remove this session.' }

  revalidatePath('/archive/trpg')
  return { error: null }
}
