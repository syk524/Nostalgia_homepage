'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { EventVisibility } from '@/types/database'

async function requireEditor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: 'You must be signed in.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'editor' && profile?.role !== 'admin') {
    return { supabase, user: null, error: 'You don’t have edit authority for the calendar.' }
  }
  return { supabase, user, error: null }
}

export async function addEvent(input: { date: string; title: string; dotColor: string; visibility: EventVisibility }) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { event: null, error: authError }

  const { data: event, error } = await supabase
    .from('calendar_events')
    .insert({
      event_date: input.date,
      title: input.title.trim(),
      dot_color: input.dotColor,
      visibility: input.visibility,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error || !event) return { event: null, error: error?.message ?? 'Could not add the event.' }
  revalidatePath('/')
  return { event, error: null }
}

export async function deleteEvent(id: string) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { error: authError }

  const { data: deleted, error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!deleted?.length) return { error: 'You don’t have permission to remove this event.' }
  revalidatePath('/')
  return { error: null }
}
