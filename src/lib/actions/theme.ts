'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isThemeKey } from '@/lib/themes'

export async function updateTheme(theme: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!isThemeKey(theme)) return { error: 'Unknown theme.' }

  const { error } = await supabase.from('profiles').update({ theme }).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true }
}
