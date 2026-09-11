import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'

// Nav's own data-fetching, split out so it can be wrapped in its own
// <Suspense fallback={null}> directly in the root layout (app/layout.tsx)
// without that layout itself having to await it — an async layout blocks
// literally everything below it, including app/loading.tsx's own
// fallback for whatever page is actually loading, which would undo the
// point of having a fast, granular loading state at all. This component
// is the one that actually suspends; the root layout around it doesn't.
//
// Previously fetched separately by (main)/layout.tsx and app/page.tsx,
// each rendering their own <Nav>, which is the reason Nav wasn't
// persistent across navigations. See nav.tsx's own "mounted once for the
// whole app" comment for why that was already the intended contract, and
// the sibling comment in app/layout.tsx for how mounting it there
// alongside {children} — both inside the same persistent ThemeProvider,
// itself a plain Context.Provider with no DOM node of its own — is what
// actually keeps this one instance from ever unmounting between pages.
export async function NavWithData() {
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

  return <Nav profile={profile} categories={categories ?? []} categoryPostCounts={categoryPostCounts} totalPostCount={totalPostCount} />
}
