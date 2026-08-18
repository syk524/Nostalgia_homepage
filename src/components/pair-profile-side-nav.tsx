import Link from 'next/link'
import { ScrambleText } from '@/components/scramble-text'

// Styled off nav.tsx's gallery category rail (same position/typography),
// but the whole block reads its color from --nav-icon-color instead of
// nav.tsx's own hardcoded ink shades — this pair's icon_color, already set
// on the page via NavIconColorSetter. Unselected items sit at reduced
// opacity on that same inherited color rather than a separate gray, so the
// whole nav reads as one icon_color-driven unit. Only shown when a pair
// actually has more than one profile — nothing to switch between otherwise.
export function PairProfileSideNav({
  pairSlug, profiles, activeProfileSlug,
}: {
  pairSlug: string
  profiles: { profile_slug: string; profile_title: string; is_primary: boolean }[]
  activeProfileSlug: string
}) {
  if (profiles.length < 2) return null

  return (
    <div
      className="hidden sm:flex flex-col items-start gap-3 font-mono fixed left-[2.6%] top-1/2 -translate-y-1/2 z-[60] text-[14px] uppercase tracking-tight"
      style={{ color: 'var(--nav-icon-color)' }}
    >
      {profiles.map(profile => {
        const active = profile.profile_slug === activeProfileSlug
        const href = profile.is_primary ? `/profile/${pairSlug}` : `/profile/${pairSlug}/${profile.profile_slug}`
        return (
          <Link key={profile.profile_slug} href={href} className={`flex items-center gap-2 ${active ? 'font-medium' : 'opacity-50'}`}>
            <ScrambleText text={profile.profile_title} />
            {active && <span className="h-[6px] w-[6px] rounded-full bg-current shrink-0" />}
          </Link>
        )
      })}
    </div>
  )
}
