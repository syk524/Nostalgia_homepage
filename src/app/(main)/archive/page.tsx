import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Admin-only debugging section — not just unlinked from Nav, the route
// itself 404s for editors and anonymous visitors so it can't be
// reached by guessing the URL either.
export default async function ArchivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null

  if (profile?.role !== 'admin') notFound()

  return (
    <div className="animate-fade-up space-y-2">
      <h2 className="text-3xl text-ink">Archive</h2>
      <p className="text-ink-500">Coming soon.</p>
    </div>
  )
}
