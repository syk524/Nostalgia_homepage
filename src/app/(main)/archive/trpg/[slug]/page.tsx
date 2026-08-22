import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TrpgSessionView } from '@/components/trpg-session-editor'
import { ParticleEffect } from '@/components/particle-effects'
import { DeleteSessionButton } from './delete-session-button'
import { ScrollBounceLock } from '@/components/scroll-bounce-lock'
import type { TrpgSession } from '@/types/database'

// No admin/canEdit check here — archive/layout.tsx already gates every
// /archive/* route, so unlike gallery's post detail page, Edit/Delete are
// always shown (there's no "viewer without edit rights" case under
// Archive at all).
export default async function TrpgSessionPage({ params }: { params: Promise<{ slug: string }> }) {
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
    <>
      {typedSession.background_url && <ScrollBounceLock />}

      {/* Full-bleed custom background — same mechanics as
          character-pair-detail.tsx's own: a fixed, full-viewport <img>
          with a CSS blur filter (not backdrop-filter), scale-105 to push
          the blur's softened edge outside the visible area, and the 1-100
          stored blur strength mapped linearly onto a 0-40px radius. */}
      {typedSession.background_url && (
        <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
          <img
            src={typedSession.background_url}
            alt=""
            className="w-full h-full object-cover scale-105"
            style={{ filter: `blur(${(typedSession.background_blur / 100) * 40}px)` }}
          />
        </div>
      )}

      {/* Optional ambient overlay (rain, more to come — see
          particle-effects.tsx) picked in the create/edit form. z-[1] so
          it sits above the background (z-0) — the log card below gets an
          explicit z-10 so it stacks above this regardless of DOM order,
          rather than relying on implicit stacking rules. */}
      <ParticleEffect effect={typedSession.particle_effect} />

      {/* Fixed, icon-only, positioned like the pair-detail page's own back
          button (character-pair-detail.tsx) — same top-rail placement as
          Nav's own left-edge widgets. No per-page icon_color to drive it
          the way a pair's own back button does (Archive has no per-page
          tint concept — see archive-side-nav.tsx), so this is a fixed
          ink color instead. */}
      <Link
        href="/archive/trpg"
        aria-label="Back to TRPG"
        className="fixed left-[2.6%] top-[3%] z-[60] inline-flex w-8 h-8 rounded-full items-center justify-start text-ink-400 hover:opacity-70 transition-opacity"
      >
        <ArrowLeft size={18} />
      </Link>

      <div className="relative z-10 animate-fade-up max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl text-ink">{typedSession.title}</h2>
            {typedSession.date_range && (
              <p className="text-ink-400 text-xs font-mono mt-1">{typedSession.date_range}</p>
            )}
            {typedSession.description && (
              <p className="text-ink-400 text-sm mt-2 max-w-prose">{typedSession.description}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/archive/trpg/${typedSession.slug}/edit`} className="btn-ghost">Edit</Link>
            <DeleteSessionButton sessionId={typedSession.id} />
          </div>
        </div>

        <div className="card p-6">
          <TrpgSessionView content={typedSession.body} />
        </div>
      </div>
    </>
  )
}
