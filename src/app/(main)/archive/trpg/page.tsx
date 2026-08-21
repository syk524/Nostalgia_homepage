import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/format'
import type { TrpgSession } from '@/types/database'

// No admin check here — archive/layout.tsx already gates every /archive/*
// route, and RLS independently enforces the same thing at the DB level.
export default async function TrpgListPage() {
  const supabase = await createClient()
  const { data: sessions } = await supabase
    .from('trpg_sessions')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl text-ink">TRPG</h2>
        <Link href="/archive/trpg/new" className="btn-primary">New Session</Link>
      </div>

      {!sessions?.length && (
        <p className="text-ink-500">No sessions logged yet — back up the first one.</p>
      )}

      <div className="card divide-y divide-scroll-300">
        {(sessions as Pick<TrpgSession, 'id' | 'title' | 'created_at'>[] ?? []).map(session => (
          <Link
            key={session.id}
            href={`/archive/trpg/${session.id}`}
            className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-scroll-100 transition-colors"
          >
            <span className="text-ink truncate">{session.title}</span>
            <span className="text-ink-400 text-xs font-mono shrink-0">{formatDate(session.created_at)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
