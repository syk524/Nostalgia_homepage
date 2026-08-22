import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewSessionForm } from './new-session-form'

// archive/layout.tsx no longer gates /archive/* at all (viewing is public
// now) — creating a session is still editor-or-admin-only, so that check
// has to live here instead. Same flat 404 as before, not a "log in first"
// redirect, so a guest poking at the URL directly can't tell this route
// exists.
export default async function NewSessionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  if (profile?.role !== 'editor' && profile?.role !== 'admin') notFound()

  return <NewSessionForm />
}
