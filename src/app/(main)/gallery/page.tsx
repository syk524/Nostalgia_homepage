import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { GalleryGrid } from '@/components/gallery-grid'
import { TrackListView } from '@/components/track-list-view'
import type { Post, Profile, PostImage, Category } from '@/types/database'

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category: categoryName } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data as Profile | null
    : null
  const canEdit = profile?.role === 'editor' || profile?.role === 'admin'

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

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

  const { data: posts } = await postsQuery

  // Drag-reordering only makes sense on the unfiltered view — reordering a
  // filtered subset would leave the interleaving with other categories'
  // posts ambiguous, so filtered views stay read-only.
  const canReorder = canEdit && !activeCategory

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
      <div className="w-screen relative left-1/2 -translate-x-1/2 px-6 sm:pl-[calc(2.6vw+159px)]">
        <div className="max-w-[1800px] animate-fade-up space-y-8">
          {canEdit && (
            // Plain <a>, not next/link — /gallery/new is a static sibling of
            // the dynamic [id] route, but the modal's interception rewrite
            // matches any single segment under /gallery/ on soft navigation,
            // so a client-side Link click here landed in the post-detail
            // modal with id="new" instead of the real page. A full
            // navigation skips the client router (and its next-url header)
            // entirely, so the rewrite never matches and this resolves
            // normally server-side.
            //
            // In normal flow (not fixed) so the grid below it — a sibling in
            // this space-y-8 container — always sits a clean 32px under it,
            // instead of the two independently-positioned elements risking
            // an overlap on shorter viewports.
            <div className="flex justify-end">
              <a href="/gallery/new" className="btn-primary">New Post</a>
            </div>
          )}

          {/* Category filters, inline at the top — only shown below sm, where
              Nav's floating category pills (see nav.tsx) are hidden for lack
              of room. */}
          <div className="flex sm:hidden flex-wrap gap-2">
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

          <GalleryGrid
            posts={(posts ?? []) as unknown as (Post & { author: Profile; images: PostImage[]; category: Category })[]}
            canReorder={canReorder}
          />
        </div>
      </div>
    </>
  )
}
