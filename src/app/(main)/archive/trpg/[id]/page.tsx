import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/format'
import { TrpgSessionView } from '@/components/trpg-session-editor'
import { DeleteSessionButton } from './delete-session-button'
import type { TrpgSession } from '@/types/database'

// No admin/canEdit check here — archive/layout.tsx already gates every
// /archive/* route, so unlike gallery's post detail page, Edit/Delete are
// always shown (there's no "viewer without edit rights" case under
// Archive at all).
export default async function TrpgSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: session } = await supabase
    .from('trpg_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (!session) notFound()
  const typedSession = session as TrpgSession

  return (
    <div className="animate-fade-up max-w-3xl space-y-6">
      <Link href="/archive/trpg" className="text-ink-400 hover:text-ink text-sm font-mono">&larr; Back to TRPG</Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl text-ink">{typedSession.title}</h2>
          <p className="text-ink-400 text-xs font-mono mt-1">{formatDate(typedSession.created_at)}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/archive/trpg/${typedSession.id}/edit`} className="btn-ghost">Edit</Link>
          <DeleteSessionButton sessionId={typedSession.id} />
        </div>
      </div>

      <div className="card p-6">
        <TrpgSessionView content={typedSession.body} />
      </div>
    </div>
  )
}
