import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data
    : null

  // categories and post counts don't depend on each other, so they run
  // together rather than as two sequential round trips. Only category_id
  // is selected for the count — the full post rows (author/images/etc.)
  // aren't needed here, this is purely a per-category tally for the
  // gallery rail's own label counts (desktop only, see nav.tsx).
  const [{ data: categories }, { data: postCategoryIds }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order', { ascending: true }),
    supabase.from('posts').select('category_id'),
  ])

  const categoryPostCounts: Record<string, number> = {}
  for (const { category_id } of postCategoryIds ?? []) {
    categoryPostCounts[category_id] = (categoryPostCounts[category_id] ?? 0) + 1
  }
  const totalPostCount = postCategoryIds?.length ?? 0

  return (
    <div className="relative min-h-screen overflow-hidden bg-scroll-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 w-full h-full opacity-[0.05] bg-[length:28px_28px] bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)]"
      />
      <div className="relative">
        <Suspense fallback={null}>
          <Nav profile={profile} categories={categories ?? []} categoryPostCounts={categoryPostCounts} totalPostCount={totalPostCount} />
        </Suspense>
        {/* px-4 (mobile) / min-[1020px]:px-6 (desktop, unchanged) — 16px
            side margins on a phone screen, reported directly, down from
            the same 24px used at every width before. */}
        <main className="max-w-5xl mx-auto px-4 min-[1020px]:px-6 pt-24 pb-16">{children}</main>
      </div>
    </div>
  )
}
