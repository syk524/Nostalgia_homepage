import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EditSessionForm } from './edit-session-form'
import type { TrpgSession } from '@/types/database'

// archive/layout.tsx no longer gates /archive/* at all (viewing is public
// now) — editing a session is still editor-or-admin-only, so that check
// has to live here instead, same as trpg/new/page.tsx.
export default async function EditSessionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const [{ data: { user } }, { data: session }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('trpg_sessions').select('*').eq('slug', slug).single(),
  ])
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  if (profile?.role !== 'editor' && profile?.role !== 'admin') notFound()

  if (!session) notFound()
  const typedSession = session as TrpgSession

  return (
    <EditSessionForm
      sessionId={typedSession.id}
      initialSlug={typedSession.slug}
      initialTitle={typedSession.title}
      initialDateRange={typedSession.date_range}
      initialDescription={typedSession.description}
      initialBody={typedSession.body}
      initialBackgroundUrl={typedSession.background_url}
      initialBackgroundBlur={typedSession.background_blur}
      initialParticleEffect={typedSession.particle_effect}
      initialIconColor={typedSession.icon_color}
    />
  )
}
