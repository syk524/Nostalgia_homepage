import { Suspense } from 'react'
import { IllustPageBg } from '@/components/illust-page-bg'
import { DotMatrixLoader } from '@/components/dot-matrix-loader'

// Nav used to be rendered (and fetched) here — moved up to the root
// layout (app/layout.tsx, via NavWithData) so it's a single instance
// shared with the home scene too, instead of two separate copies that
// unmounted and remounted each other on a home <-> other-page
// navigation. See that component's own comment. Nothing else in this
// layout needed the profile/categories/post-count fetch that used to
// live here, so it's gone entirely rather than kept around unused —
// this layout no longer touches Supabase at all.
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Every page other than the home scene (draggable-home-scene.tsx,
          rendered from the separate top-level app/page.tsx that this
          layout never wraps) gets the same landing-page illustration
          here too, per direct request — blurred and dimmed rather than
          plain solid black, instead of Illust otherwise looking
          identical to Noir off the landing page. IllustPageBg is CSS-
          driven (visible only under [data-theme="illust"], globals.css)
          rather than a `theme === 'illust'` check here, deliberately —
          this is a server component, and getUserTheme() only knows a
          guest's server-rendered default (always 'noir'), never a
          guest's client-only localStorage choice (see that function's
          own isGuest comment). The CSS attribute selector reacts to
          data-theme regardless of which side set it, so this stays
          correct for a guest who switched themes purely client-side.
          Also reused as-is by the root loading.tsx, for the same
          backdrop during a route's loading state. */}
      <IllustPageBg />
      {/* main-grid-texture: hidden on Noir and Illust (globals.css) per
          direct request — this faint line grid was showing unconditionally
          regardless of theme, visibly competing with both Noir's own
          plain black backdrop and Illust's illustration/particle-free
          backdrop. Stays for Default (Sticker), which has no backdrop
          of its own to conflict with. CSS-gated rather than a
          `theme === 'default'` check here for the same guest/localStorage
          reason as IllustPageBg above. */}
      <div
        aria-hidden="true"
        className="main-grid-texture pointer-events-none absolute top-0 right-0 w-full h-full opacity-[0.05] bg-[length:28px_28px] bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)]"
      />
      <div className="relative">
        {/* px-4 (mobile) / min-[1020px]:px-6 (desktop, unchanged) — 16px
            side margins on a phone screen, reported directly, down from
            the same 24px used at every width before. */}
        <main className="max-w-5xl mx-auto px-4 min-[1020px]:px-6 pt-24 pb-16">
          {/* This layout (IllustPageBg, the grid texture) persists
              across every navigation within (main) — only {children}
              itself, the target page's own async Server Component,
              actually suspends. Without its own boundary here, that
              suspension had no local fallback to show: the root
              loading.tsx's boundary only wraps this ENTIRE layout, and
              since this layout doesn't remount for a same-group
              navigation, that boundary never re-triggers either —
              reported directly as some navigations (within this group)
              showing no loading indicator at all, just the static
              backdrop sitting there with an empty content area, unlike
              a genuinely new top-level navigation (which does hit
              app/loading.tsx's own DotMatrixLoader). Same dot here,
              for the same visible feedback either way.

              fixed inset-0, not a plain flex/py-24 box in normal flow —
              a box centered within just <main>'s own content area (which
              starts below the fixed nav, at pt-24) sits noticeably
              higher on screen than app/loading.tsx's own dot, which
              centers in the full viewport. The mismatch read as the dot
              visibly jumping upward the instant this boundary took over
              from that one, reported directly. Anchoring to the exact
              same full-viewport center here means the dot never actually
              moves between the two loading phases — it just sits still
              until it disappears. */}
          <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><DotMatrixLoader size={40} /></div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
