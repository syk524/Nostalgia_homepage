import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EditSessionForm } from './edit-session-form'
import type { TrpgSession } from '@/types/database'

// No admin check here — archive/layout.tsx already gates every /archive/*
// route.
export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: session } = await supabase
    .from('trpg_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (!session) notFound()
  const typedSession = session as TrpgSession

  return <EditSessionForm sessionId={typedSession.id} initialTitle={typedSession.title} initialBody={typedSession.body} />
}
