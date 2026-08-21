'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ScrambleText } from '@/components/scramble-text'

const SECTIONS = [
  { href: '/archive/trpg', label: 'TRPG' },
  { href: '/archive/links', label: 'Links' },
]

// Styled off nav.tsx's gallery category rail / pair-profile-side-nav.tsx
// (same position/typography), but static — two fixed sections, not a
// dynamic list — and plain text-ink/text-ink-400 rather than
// --nav-icon-color, since Archive has no per-page tint the way a
// character pair's icon_color does.
export function ArchiveSideNav() {
  const pathname = usePathname()

  return (
    <div className="hidden sm:flex flex-col items-start gap-3 font-mono fixed left-[2.6%] top-1/2 -translate-y-1/2 z-[60] text-[14px] uppercase tracking-tight">
      {SECTIONS.map(section => {
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
  )
}
