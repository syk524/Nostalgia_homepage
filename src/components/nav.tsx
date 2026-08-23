'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ProfileMenu } from '@/components/profile-menu'
import { ScrambleText } from '@/components/scramble-text'
import type { Profile, Category } from '@/types/database'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/profile', label: 'Profile' },
  { href: '/archive', label: 'Archive' },
  { href: '/gallery', label: 'Gallery' },
]

// Same style on every render, server or client — the actual color comes
// from the --nav-icon-color CSS variable (see globals.css), which a page
// deep in the tree can override imperatively via nav-icon-color-setter.tsx.
const NAV_COLOR_STYLE = { color: 'var(--nav-icon-color)' }

function NavDot() {
  // Color comes from the ancestor's `color` (bg-current) — see Nav below.
  return <span className="nav-dot" />
}

// The post modal's @modal parallel-route slot (gallery/@modal/(.)[id]/)
// only ever gets populated while the URL is a post-detail path — that's
// the one case Next.js fails to reconcile on a soft navigation to a
// sibling route (the modal overlay sticks around instead of clearing),
// which is why category links used to hard-navigate unconditionally.
// Category switching is common enough, and the site-wide music player
// (mounted once in the root layout, outside every route segment) loses
// all its in-memory playback state on a hard reload, so the workaround
// is scoped to just the path shape that can actually trigger the bug —
// everywhere else gets a normal soft-navigating Link, which never
// touches the player. Excludes /gallery/new and /gallery/[id]/edit,
// neither of which the modal slot ever intercepts.
function CategoryLink({ href, hardNav, className, children }: {
  href: string
  hardNav: boolean
  className: string
  children: React.ReactNode
}) {
  if (hardNav) return <a href={href} className={className}>{children}</a>
  return <Link href={href} className={className}>{children}</Link>
}

// One Nav, mounted once for the whole app — it never remounts or changes
// look between the homepage and any gallery view (grid, post, edit). Its
// z-index sits above the post modal's overlay so it stays visible,
// unchanged, even when a post is open; the category links below are just
// conditionally shown extra content on the same persistent component,
// not a separate nav.
export function Nav({ profile, categories }: { profile: Profile | null; categories: Category[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const onGallery = pathname === '/gallery' || pathname.startsWith('/gallery/')
  const onPostDetail = /^\/gallery\/(?!new$)[^/]+$/.test(pathname)
  const activeCategory = searchParams.get('category')
  // Prefix match, not exact — Archive and Profile stay underlined on
  // their own subpages (/archive/trpg/[slug], /profile/[slug], etc.), not
  // just the bare grid route. '/' is exact-only since every path starts
  // with it.
  const isActiveLink = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
  // Both Profile and Archive are shown to everyone, including guests —
  // reported directly. This tracks actual access, not the other way
  // around: a guest can view the profile grid and every pair's own hero
  // (middleware.ts + RLS, see migration 066), just not the description/
  // timeline beneath it, so hiding the nav entry would only hide a
  // section guests can already reach by clicking into a card.
  const links = LINKS

  // Below 1020px (this site's own mobile/desktop breakpoint) there's no
  // room for the links row laid out horizontally, so it collapses behind
  // a single toggle button that opens a full-screen menu instead —
  // behavior modeled on a hamburger-triggered full-screen nav overlay
  // (reported directly), reimplemented here with this app's own look
  // (mono/uppercase links, NavDot bullets, --nav-icon-color) rather than
  // any borrowed styling. 1020px+ never sees any of this — the plain
  // links row above stays exactly as it always has.
  const [menuPhase, setMenuPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Matches --popout-close-dur in globals.css's .t-nav-menu rule (shared
  // with .t-popout — see that rule's own comment) — is-closing has to be
  // removed via this timer, not left to linger, so a second open before
  // it fires doesn't skip straight to 'open' with a stale is-closing
  // class still attached.
  function toggleMenu() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    if (menuPhase === 'open') {
      setMenuPhase('closing')
      closeTimerRef.current = setTimeout(() => setMenuPhase('closed'), 150)
    } else {
      setMenuPhase('open')
    }
  }

  // Tapping a link inside the open menu navigates away immediately, so
  // there's nothing left to play the closing transition over — jumping
  // straight to 'closed' (no 'closing' interim) avoids a dangling timer
  // that would fire after the component's already moved on to whatever
  // page-level UI the new route brings in.
  function closeMenuImmediately() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setMenuPhase('closed')
  }

  useEffect(() => {
    if (menuPhase !== 'open') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') toggleMenu()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuPhase])

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }, [])

  return (
    <>
      <nav className="hidden min-[1020px]:flex font-mono fixed right-[2.6%] top-[3%] z-[60] items-center gap-10 text-[14px] uppercase tracking-tight text-ink" style={NAV_COLOR_STYLE}>
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 ${isActiveLink(link.href) ? 'underline underline-offset-4' : ''}`}
          >
            <NavDot />
            <ScrambleText text={link.label} />
          </Link>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggleMenu}
        aria-label={menuPhase === 'open' ? 'Close menu' : 'Open menu'}
        aria-expanded={menuPhase === 'open'}
        className="flex min-[1020px]:hidden items-center gap-2 font-mono fixed right-[2.6%] top-[3%] z-[70] text-[14px] uppercase tracking-tight text-ink"
        style={NAV_COLOR_STYLE}
      >
        <NavDot />
        <ScrambleText text={menuPhase === 'open' ? 'Close' : 'Menu'} />
      </button>

      {menuPhase !== 'closed' && (
        // Adapted from the same "modal open/close" scale+fade recipe as
        // dock-music-widget.tsx's own .t-popout (see .t-nav-menu in
        // globals.css) — full-viewport instead of a small anchored box,
        // but the same is-open/is-closing 3-state dance and shared
        // --popout-* timing/easing custom properties rather than a
        // second copy of the same numbers under new names.
        <div
          className={`t-nav-menu min-[1020px]:hidden fixed inset-0 z-[65] bg-scroll-100 flex flex-col justify-center px-6 ${menuPhase === 'open' ? 'is-open' : 'is-closing'}`}
        >
          <nav className="font-mono flex flex-col items-start gap-8 text-[28px] uppercase tracking-tight text-ink" style={NAV_COLOR_STYLE}>
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenuImmediately}
                className={`flex items-center gap-3 ${isActiveLink(link.href) ? 'underline underline-offset-4' : ''}`}
              >
                <NavDot />
                <ScrambleText text={link.label} />
              </Link>
            ))}
          </nav>
        </div>
      )}

      {onGallery && (
        <div className="hidden min-[1020px]:flex flex-col items-start gap-3 font-mono fixed left-[2.6%] top-1/2 -translate-y-1/2 z-[60] text-[14px] uppercase tracking-tight">
          {/* Selected = full-strength text + a trailing filled circle;
              unselected = muted text, no marker at all — no square dot,
              no underline. Text scrambles into place on hover (see
              scramble-text.tsx — an original small reimplementation of the
              "decode" effect, not the use-scramble package itself).
              hardNav only kicks in on a post-detail path — see
              CategoryLink's own comment for why. */}
          <CategoryLink href="/gallery" hardNav={onPostDetail} className={`flex items-center gap-2 ${!activeCategory ? 'text-ink font-medium' : 'text-ink-400'}`}>
            <ScrambleText text="All" />
            {!activeCategory && <span className="h-[6px] w-[6px] rounded-full bg-current shrink-0" />}
          </CategoryLink>
          {categories.map(cat => (
            <CategoryLink
              key={cat.id}
              href={`/gallery?category=${encodeURIComponent(cat.name)}`}
              hardNav={onPostDetail}
              className={`flex items-center gap-2 ${activeCategory === cat.name ? 'text-ink font-medium' : 'text-ink-400'}`}
            >
              <ScrambleText text={cat.name} />
              {activeCategory === cat.name && <span className="h-[6px] w-[6px] rounded-full bg-current shrink-0" />}
            </CategoryLink>
          ))}
        </div>
      )}

      <div className="font-mono fixed bottom-[3%] left-[2.6%] z-[60] text-[14px] uppercase tracking-tight text-ink" style={NAV_COLOR_STYLE}>
        {profile ? (
          <ProfileMenu profile={profile} />
        ) : (
          <Link href="/auth/login" className="flex items-center gap-2">
            <NavDot />
            Log In
          </Link>
        )}
      </div>
    </>
  )
}
