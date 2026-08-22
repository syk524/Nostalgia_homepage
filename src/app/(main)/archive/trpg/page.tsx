import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { TrpgSession } from '@/types/database'

type ListedSession = Pick<TrpgSession, 'id' | 'slug' | 'title' | 'date_range' | 'description' | 'cover_url'>

// Same shape as character-pair-grid.tsx's own AddPairCard: a quiet-at-rest
// tile matching every real card's own cover-image footprint, the plus
// icon alone as the label (no caption row below it — a real card's title/
// date/description block would leave a misleading blank space here since
// this tile has none of that). self-start, not self-end — reported
// directly: the tile should align with the top of the row (where every
// card's own cover image sits) rather than trail down to match the
// bottom of whichever neighboring card's caption happens to be tallest.
function AddSessionCard() {
  return (
    <Link href="/archive/trpg/new" className="group block self-start">
      <div className="w-full aspect-[3/4] rounded flex items-center justify-center text-scroll-400 transition-colors group-hover:text-ink-600 group-hover:bg-[#5C574D]/20">
        <Plus size={28} />
      </div>
    </Link>
  )
}

// Viewing is public (see archive/layout.tsx) — canEdit gates just the
// AddSessionCard tile below, same pattern as gallery-grid.tsx's own
// canEdit-gated AddPostTile.
export default async function TrpgListPage() {
  const supabase = await createClient()
  const [{ data: { user } }, { data: sessions }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('trpg_sessions').select('id, slug, title, date_range, description, cover_url').order('created_at', { ascending: false }),
  ])
  const profile = user
    ? (await supabase.from('profiles').select('role').eq('id', user.id).single()).data
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  return (
    // Same breakout as profile/page.tsx: escapes the shared <main>'s
    // centered max-w-5xl so this list fills the rest of the screen width
    // instead of stopping at 1024px, with sm:pl clearing the same
    // side-nav gutter (ArchiveSideNav's own left-[2.6%]) so rows never
    // sit under it. animate-fade-up has to stay off this outer div and
    // live on the inner one instead — its keyframe sets `transform:
    // translateY(...)`, which as a plain CSS animation would replace the
    // whole `transform` property and cancel out this div's own
    // -translate-x-1/2 (see profile/page.tsx and character-pair-detail.tsx
    // for the same fix).
    <div className="w-screen relative left-1/2 -translate-x-1/2 px-6 sm:pl-[calc(2.6vw+159px)]">
      <div className="animate-fade-up space-y-8">
        {!sessions?.length && (
          <p className="text-ink-500">No sessions logged yet — back up the first one.</p>
        )}

        {/* Book-cover grid, 4 across — each session's cover_url (picked in
            the editor via the star button on any non-avatar image, see
            TrpgImageView in trpg-session-editor.tsx) stands in for a book's
            own jacket art, with the session's title as the caption below
            it in place of a book's "Chapter" label. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-12">
          {(sessions as ListedSession[] ?? []).map(session => (
            <Link key={session.id} href={`/archive/trpg/${session.slug}`} className="group flex flex-col items-center">
              <div className="w-full aspect-[3/4] group-hover:-translate-y-1 transition-all duration-200 overflow-hidden rounded bg-scroll-100">
                {session.cover_url ? (
                  <img src={session.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-scroll-300 text-scroll-400 text-3xl">◯</div>
                )}
              </div>
              <p
                className="mt-3 text-center text-[15px] tracking-[0.02em] text-ink truncate w-full"
                style={{ fontFamily: 'var(--font-chosun-nm), Georgia, serif' }}
              >
                {session.title}
              </p>
              {/* Both freeform plain text (see EditSessionForm's own
                  comment on why) — smaller and muted, sitting under the
                  title rather than competing with it for the reader's eye,
                  same relationship formatDate's own small mono caption had
                  on the old list-row layout this grid replaced. */}
              {session.date_range && (
                <p className="mt-0.5 text-center text-[11px] font-mono text-ink-400 truncate w-full">
                  {session.date_range}
                </p>
              )}
              {session.description && (
                <p className="mt-1 text-center text-xs text-ink-400 line-clamp-2 w-full">
                  {session.description}
                </p>
              )}
            </Link>
          ))}
          {canEdit && <AddSessionCard />}
        </div>
      </div>
    </div>
  )
}
