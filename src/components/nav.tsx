'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
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
  // reported directly. The links themselves are just entry points; actual
  // access is enforced where it always was (middleware.ts lets the
  // /profile and /archive grids through but still gates each individual
  // pair page and every /archive/* page behind login/role, see those
  // files' own comments), so widening nav visibility here doesn't loosen
  // anything a guest can actually reach.
  const links = LINKS

  return (
    <>
      <nav className="font-mono fixed right-[2.6%] top-[3%] z-[60] flex items-center gap-10 text-[14px] uppercase tracking-tight text-ink" style={NAV_COLOR_STYLE}>
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

      {onGallery && (
        <div className="hidden sm:flex flex-col items-start gap-3 font-mono fixed left-[2.6%] top-1/2 -translate-y-1/2 z-[60] text-[14px] uppercase tracking-tight">
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
