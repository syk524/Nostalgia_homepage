import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { GalleryGrid } from '@/components/gallery-grid'
import { TrackListView } from '@/components/track-list-view'
import type { Post, Profile, PostImage, Category } from '@/types/database'

// Reading `searchParams` already makes this dynamic on the server —
// every request re-runs this component — but the category links (both
// here and in nav.tsx) are plain client-side Links, and Next's client
// Router Cache was serving a stale cached RSC payload for /gallery on
// a searchParams-only navigation: the URL and the nav's own active-
// category highlight updated correctly (those are client state), but
// the grid kept showing whatever was cached from an earlier visit to
// this route. force-dynamic opts this route out of that cache so every
// category switch is guaranteed a fresh fetch.
export const dynamic = 'force-dynamic'

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category: categoryName } = await searchParams
  const supabase = await createClient()

  // getUser() and categories don't depend on each other — the old code
  // awaited them one after another (plus profile, plus posts: four
  // sequential round trips in total), which is exactly the kind of wait
  // that made Cancel on the edit/new-post forms look stuck for a second
  // before finally landing here. profile depends on user.id, and posts
  // depends on activeCategory (resolved from categories), so those two
  // waterfalls are unavoidable — but each pair that doesn't depend on the
  // other now runs together instead of back to back.
  const [{ data: { user } }, { data: categories }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('categories').select('*').order('sort_order', { ascending: true }),
  ])

  // Unknown/stale category name in the URL falls back to "All" rather than
  // showing an empty grid.
  const activeCategory = categoryName
    ? (categories ?? []).find(c => c.name === categoryName)
    : undefined

  let postsQuery = supabase
    .from('posts')
    .select('*, author:profiles(*), images:post_images(*), category:categories(*)')
    .order('position', { ascending: true })

  if (activeCategory) postsQuery = postsQuery.eq('category_id', activeCategory.id)

  const [{ data: profile }, { data: posts }] = await Promise.all([
    user
      ? supabase.from('profiles').select('*').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    postsQuery,
  ])
  const canEdit = (profile as Profile | null)?.role === 'editor' || (profile as Profile | null)?.role === 'admin'

  // Drag-reordering only makes sense on the unfiltered view — reordering a
  // filtered subset would leave the interleaving with other categories'
  // posts ambiguous, so filtered views stay read-only.
  const canReorder = canEdit && !activeCategory

  // Carries the active category into the new-post form as a pre-fill,
  // not a lock — matches the URL shape the category pills already use
  // (?category=<name>), so new-post-form.tsx can resolve it the same
  // way this page resolves activeCategory above.
  const newPostHref = activeCategory ? `/gallery/new?category=${encodeURIComponent(activeCategory.name)}` : '/gallery/new'

  return (
    <>
      <Suspense fallback={null}>
        <TrackListView />
      </Suspense>

      {/* Breaks out of the shared <main>'s centered max-w-5xl — that
          centering grows the left margin on wide viewports independently of
          the pills (which are fixed relative to the real viewport edge),
          stacking with the old fixed pl-32 into a gap that kept widening
          with the screen. This anchors content a fixed distance from the
          true viewport edge instead, so the gap stays constant and the
          inner max-w cap (not mx-auto) is what lets the grid actually grow
          wider — and its thumbnails with it — on bigger screens.
          calc(2.6vw+159px): the nav links sit at left-2.6% (fixed
          positioning, so it resolves against the true viewport) and are
          ~99px wide (their widest label, "Commission") — vw here matches
          that same viewport-relative basis (plain % would resolve against
          this div's own containing block instead, which is narrower and
          throws the match off), clearing their edge with a steady 60px gap. */}
      {/* px-4 (mobile)/min-[1020px]:pr-6 (desktop right edge, unchanged) —
          written as two separate side-specific classes rather than px-6
          plus an overriding pl, so the desktop-only
          pl-[calc(2.6vw+159px)] below is never fighting another
          same-breakpoint class over the same property. */}
      <div className="w-screen relative left-1/2 -translate-x-1/2 px-4 min-[1020px]:pr-6 min-[1020px]:pl-[calc(2.6vw+159px)]">
        <div className="max-w-[1800px] animate-fade-up space-y-8">
          {/* Category filters, inline at the top — only shown below 1020px
              (this page's own mobile/desktop breakpoint, matching nav.tsx's
              own min-[1020px]:flex below), where Nav's floating category
              pills (see nav.tsx) are hidden for lack of room. */}
          <div className="flex min-[1020px]:hidden flex-wrap gap-2">
            <Link href="/gallery" className={!activeCategory ? 'pill pill-active' : 'pill'}>All</Link>
            {(categories ?? []).map((cat: Category) => (
              <Link
                key={cat.id}
                href={{ pathname: '/gallery', query: { category: cat.name } }}
                className={activeCategory?.id === cat.id ? 'pill pill-active' : 'pill'}
              >
                {cat.name}
              </Link>
            ))}
          </div>

          {!posts?.length && (
            <p className="text-ink-500">No posts yet{canEdit ? ' — write the first one.' : '.'}</p>
          )}

          {/* Keyed on the active category: GalleryGrid mirrors its `posts`
              prop into local state (needed for the optimistic drag-reorder
              update), which only ever syncs on mount — a soft navigation
              to a new category re-renders this with a fresh, correctly-
              filtered `posts` prop, but without a key change GalleryGrid
              keeps whatever it already had in state from the previous
              category instead of picking up the new list. This used to be
              masked by category links doing a full page reload (nav.tsx),
              which remounted everything unconditionally; now that those
              are a normal soft-navigating Link, the key is what forces a
              fresh instance (and fresh state) per category. Reordering is
              disabled on every filtered view anyway, so there's never a
              legitimate case where in-progress reorder state should
              survive a category switch. */}
          <GalleryGrid
            key={activeCategory?.id ?? 'all'}
            posts={(posts ?? []) as unknown as (Post & { author: Profile; images: PostImage[]; category: Category })[]}
            canReorder={canReorder}
            canEdit={canEdit}
            newPostHref={newPostHref}
          />
        </div>
      </div>
    </>
  )
}
