'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const username = (formData.get('username') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  // Generate the same synthetic email we used at registration
  const email = `${username}@nostalgia.local`

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Incorrect username or password.' }
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function register(_: unknown, formData: FormData) {
  const supabase = await createClient()
  const username    = (formData.get('username') as string)?.trim().toLowerCase()
  const displayName = (formData.get('display_name') as string)?.trim()
  const password    = formData.get('password') as string

  if (!username || username.length < 3)
    return { error: 'Username must be at least 3 characters.' }
  if (!/^[a-z0-9_]+$/.test(username))
    return { error: 'Username can only contain lowercase letters, numbers, and underscores.' }
  // Synthetic email — user never sees this
  const email = `${username}@nostalgia.local`

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: displayName || username } },
  })
  if (error) {
    if (error.message.includes('already registered'))
      return { error: 'That username is already taken.' }
    return { error: error.message }
  }
  revalidatePath('/', 'layout')
  redirect('/gallery')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
