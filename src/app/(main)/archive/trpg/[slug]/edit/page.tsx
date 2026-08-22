import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EditSessionForm } from './edit-session-form'
import type { TrpgSession } from '@/types/database'

// No admin check here — archive/layout.tsx already gates every /archive/*
// route.
export default async function EditSessionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: session } = await supabase
    .from('trpg_sessions')
    .select('*')
    .eq('slug', slug)
    .single()

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
    />
  )
}
