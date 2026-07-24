'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ProfileMenu } from '@/components/profile-menu'
import type { Profile } from '@/types/database'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/profile', label: 'Profile' },
  { href: '/archive', label: 'Archive' },
  { href: '/gallery', label: 'Gallery' },
]

function NavDot() {
  return <span className="nav-dot text-ink" />
}

export function Nav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()

  return (
    <>
      <nav className="font-mono fixed right-[2.6%] top-[3%] z-20 flex items-center gap-10 text-[16px] uppercase tracking-tight text-ink">
        {LINKS.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 ${pathname === link.href ? 'underline underline-offset-4' : ''}`}
          >
            <NavDot />
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="font-mono fixed bottom-[3%] left-[2.6%] z-20 text-[16px] uppercase tracking-tight text-ink">
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
