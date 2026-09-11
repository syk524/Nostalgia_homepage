// Shared marker div for the Illust theme's blurred/dimmed landing-page
// backdrop (globals.css's .illust-page-bg rule) — used by both
// (main)/layout.tsx (every page other than the home scene) and, via
// IllustLoadingBg, the root loading.tsx (so a route's loading state gets
// the same backdrop instead of flashing flat solid black while a page's
// data is still resolving). Deliberately just an empty div with no theme
// check of its own: visibility is entirely CSS-driven off
// [data-theme="illust"], which reacts correctly even for a guest whose
// theme choice lives only in client-side localStorage — see that CSS
// rule's own comment for why a server-side check here would be wrong
// for that case.
//
// animate (default false) opts into the fade-in entrance — only
// IllustLoadingBg's own mount (the very first time this backdrop
// appears for a given navigation) should visibly fade in. (main)/
// layout.tsx's own copy renders with it left off, appearing instantly:
// by the time that one mounts, loading.tsx's already-faded-in copy has
// been showing the identical backdrop, so animating this second,
// separate DOM node's own entrance too just replayed the same fade a
// moment later — reported directly as the blur "happening twice" when
// moving between pages.
export function IllustPageBg({ animate = false }: { animate?: boolean } = {}) {
  return (
    <div aria-hidden="true" className={`illust-page-bg fixed inset-0 -z-10 overflow-hidden${animate ? ' illust-page-bg-enter' : ''}`} />
  )
}
