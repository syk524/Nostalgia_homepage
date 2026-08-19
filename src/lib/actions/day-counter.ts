'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireEditor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: 'You must be signed in.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'editor' && profile?.role !== 'admin') {
    return { supabase, user: null, error: 'You don’t have edit authority for the day counter.' }
  }
  return { supabase, user, error: null }
}

export async function updateDayCounter(id: string, input: {
  photoUrl: string | null
  photoPath: string | null
  textColor: string
  font: string
  // The path being replaced, if this save includes a new photo — passed
  // separately from photoPath (the NEW path) so the old file can be
  // cleaned up from storage after the swap, rather than left orphaned.
  oldPhotoPath?: string | null
}) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { error: authError }

  const { data: updated, error } = await supabase
    .from('day_counter')
    .update({ photo_url: input.photoUrl, photo_path: input.photoPath, text_color: input.textColor, font: input.font })
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'You don’t have permission to edit the day counter.' }

  // Only delete the old file once the new one is safely saved — doing
  // this before the update, or unconditionally, risks stranding the
  // day counter with a dangling reference if the update itself fails.
  if (input.oldPhotoPath && input.oldPhotoPath !== input.photoPath) {
    await supabase.storage.from('day-counter-photos').remove([input.oldPhotoPath])
  }

  revalidatePath('/')
  return { error: null }
}
