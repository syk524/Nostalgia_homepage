'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/types/database'

export async function createCategory(name: string): Promise<{ category?: Category; error?: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Category name is required.' }
  if (trimmed.length > 40) return { error: 'Category name is too long.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const { data, error } = await supabase
    .from('categories')
    .insert({ name: trimmed })
    .select('*')
    .single()

  if (error) {
    // Unique violation: someone already created this name (race, or a retry).
    // Hand back the existing row instead of erroring.
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('categories')
        .select('*')
        .ilike('name', trimmed)
        .maybeSingle()
      if (existing) return { category: existing }
      return { error: 'A category with that name already exists.' }
    }
    return { error: error.message }
  }

  revalidatePath('/gallery')
  return { category: data }
}
