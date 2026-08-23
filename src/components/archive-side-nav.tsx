'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ScrambleText } from '@/components/scramble-text'

// Exported so ArchiveSectionTabs (below) and any section-root list page
// (currently just trpg/page.tsx) share the exact same section list rather
// than keeping a second copy in sync.
export const ARCHIVE_SECTIONS = [
  { href: '/archive/trpg', label: 'TRPG' },
  { href: '/archive/links', label: 'Links' },
]

// Only shown on a section's own root list page (/archive/trpg,
// /archive/links) — every sub-route under one (new, a session's detail
// page, its edit page, …) hides it instead, reported directly: these are
// focused single-task pages (create/edit a session, read one), not places
// to jump to a different section from. Shared by both components below
// since they're just two responsive presentations of the same nav.
function useIsSectionRoot() {
  const pathname = usePathname()
  return ARCHIVE_SECTIONS.some(section => pathname === section.href)
}

// Styled off nav.tsx's gallery category rail / pair-profile-side-nav.tsx
// (same position/typography), but static — two fixed sections, not a
// dynamic list — and plain text-ink/text-ink-400 rather than
// --nav-icon-color, since Archive has no per-page tint the way a
// character pair's icon_color does. 1020px, not Tailwind's default sm:
// (640px) — this site's own mobile/desktop breakpoint, matching every
// other side rail (nav.tsx's category rail, pair-profile-side-nav.tsx).
// Below that, ArchiveSectionTabs (below) is the mobile presentation.
export function ArchiveSideNav() {
  const pathname = usePathname()
  const isSectionRoot = useIsSectionRoot()
  if (!isSectionRoot) return null

  return (
    // animate-fade-in, not animate-fade-up — this nav is fixed in place
    // (left-[2.6%] top-1/2, never moving), so fade-up's own translateY
    // would read as it sliding in relative to the page while the main
    // content fades up beside it, rather than the two matching. Same
    // 0.3s duration as animate-fade-up, opacity only.
    <div className="hidden min-[1020px]:block fixed left-[2.6%] top-1/2 -translate-y-1/2 z-[60] animate-fade-in">
      {/* A dedicated background panel — previously this nav had none at
          all, just floating text over whatever page content sat behind
          it. z-0 here (not just relative) deliberately opens its own
          local stacking context, so the grid img (z-index:auto) and the
          z-10 content wrapper below always resolve their paint order
          against each other rather than against anything else on the
          page. The grid asset (public/images/nostalgio-grid.svg) already
          bakes its own mix-blend-mode:soft-light + opacity into the SVG
          itself — adding that same blend mode again via CSS on this img
          double-applies it and washes the whole thing out to invisible
          against a near-white panel, so this stays a plain, unblended img. */}
      <div className="relative z-0 overflow-hidden rounded bg-scroll-50 px-5 py-6">
        <img
          src="/images/nostalgio-grid.svg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        <div className="relative z-10 flex flex-col items-start gap-3 font-mono text-[14px] uppercase tracking-tight">
          {ARCHIVE_SECTIONS.map(section => {
            const active = pathname.startsWith(section.href)
            return (
              <Link
                key={section.href}
                href={section.href}
                className={`flex items-center gap-2 ${active ? 'text-ink font-medium' : 'text-ink-400'}`}
              >
                <ScrambleText text={section.label} />
                {active && <span className="h-[6px] w-[6px] rounded-full bg-current shrink-0" />}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Mobile counterpart to ArchiveSideNav's fixed rail, below 1020px — same
// pill-row treatment as gallery/page.tsx's own inline category filters
// (.pill/.pill-active, see globals.css), placed inline at the top of a
// section-root list page's own content instead of a fixed side rail,
// since there's no room for that rail below 1020px. Callers render this
// themselves inside their own padded content wrapper (currently just
// trpg/page.tsx) rather than this living in archive/layout.tsx like
// ArchiveSideNav does, so it picks up that page's own horizontal padding
// and sits in-flow above its list — a fixed-position component can't do
// either of those.
export function ArchiveSectionTabs() {
  const pathname = usePathname()
  const isSectionRoot = useIsSectionRoot()
  if (!isSectionRoot) return null

  return (
    <div className="flex min-[1020px]:hidden flex-wrap gap-2">
      {ARCHIVE_SECTIONS.map(section => {
        const active = pathname.startsWith(section.href)
        return (
          <Link key={section.href} href={section.href} className={active ? 'pill pill-active' : 'pill'}>
            {section.label}
          </Link>
        )
      })}
    </div>
  )
}
