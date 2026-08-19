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
  const activeCategory = searchParams.get('category')
  // Archive is an admin-only debugging section — hidden from editors
  // and logged-out visitors, not just unlinked (the page itself also
  // 404s for anyone else, see archive/page.tsx).
  const links = profile?.role === 'admin' ? LINKS : LINKS.filter(link => link.href !== '/archive')

  return (
    <>
      <nav className="font-mono fixed right-[2.6%] top-[3%] z-[60] flex items-center gap-10 text-[14px] uppercase tracking-tight text-ink" style={NAV_COLOR_STYLE}>
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 ${pathname === link.href ? 'underline underline-offset-4' : ''}`}
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
              Plain <a> tags — a soft navigation from a link that lives
              inside the post modal's parallel route slot to an unrelated
              route can update the URL without re-rendering (a Next.js edge
              case); a full navigation always renders correctly. Harmless
              here too since this isn't a frequent-transition control. */}
          <a href="/gallery" className={`flex items-center gap-2 ${!activeCategory ? 'text-ink font-medium' : 'text-ink-400'}`}>
            <ScrambleText text="All" />
            {!activeCategory && <span className="h-[6px] w-[6px] rounded-full bg-current shrink-0" />}
          </a>
          {categories.map(cat => (
            <a
              key={cat.id}
              href={`/gallery?category=${encodeURIComponent(cat.name)}`}
              className={`flex items-center gap-2 ${activeCategory === cat.name ? 'text-ink font-medium' : 'text-ink-400'}`}
            >
              <ScrambleText text={cat.name} />
              {activeCategory === cat.name && <span className="h-[6px] w-[6px] rounded-full bg-current shrink-0" />}
            </a>
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
