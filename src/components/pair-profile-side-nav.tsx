import Link from 'next/link'
import { ScrambleText } from '@/components/scramble-text'

type Profile = { profile_slug: string; profile_title: string; is_primary: boolean }

function ProfileLink({ pairSlug, profile, active, className, dotPosition }: {
  pairSlug: string
  profile: Profile
  active: boolean
  className: string
  dotPosition: 'trailing' | 'top'
}) {
  const href = profile.is_primary ? `/profile/${pairSlug}` : `/profile/${pairSlug}/${profile.profile_slug}`
  const label = <ScrambleText text={profile.profile_title} />
  // Trailing (desktop): only the active item ever gets a dot at all — a
  // single inline row, so an absent dot on every other item doesn't
  // shift anything. Top (mobile/tablet, per direct request — the dot
  // moves above the label there instead of beside it): every item
  // reserves the same dot-sized slot, just invisible when inactive,
  // since a vertically stacked label would otherwise sit one dot-height
  // lower on every inactive tab than the active one.
  const dot = dotPosition === 'trailing'
    ? (active && <span className="h-[6px] w-[6px] rounded-full bg-current shrink-0" />)
    : <span className={`h-[6px] w-[6px] rounded-full bg-current shrink-0 ${active ? '' : 'invisible'}`} />
  return (
    <Link href={href} className={`${className} ${active ? 'font-medium' : 'opacity-50'}`}>
      {dotPosition === 'top' ? <>{dot}{label}</> : <>{label}{dot}</>}
    </Link>
  )
}

// Styled off nav.tsx's gallery category rail (same position/typography),
// but the whole block reads its color from --nav-icon-color instead of
// nav.tsx's own hardcoded ink shades — this pair's icon_color, already set
// on the page via NavIconColorSetter. Unselected items sit at reduced
// opacity on that same inherited color rather than a separate gray, so the
// whole nav reads as one icon_color-driven unit. Only shown when a pair
// actually has more than one profile — nothing to switch between otherwise.
// Desktop only (hidden min-[1020px]:flex) — below that width there's no
// side gutter for a fixed rail to live in, so this alone left a pair's
// non-primary profiles completely unreachable on mobile/tablet, reported
// directly. See PairProfileMobileTabs below for that width's own switcher.
export function PairProfileSideNav({
  pairSlug, profiles, activeProfileSlug,
}: {
  pairSlug: string
  profiles: Profile[]
  activeProfileSlug: string
}) {
  if (profiles.length < 2) return null

  return (
    <div
      className="hidden min-[1020px]:flex flex-col items-start gap-3 font-mono fixed left-[2.6%] top-1/2 -translate-y-1/2 z-[60] text-[14px] uppercase tracking-tight"
      style={{ color: 'var(--nav-icon-color)' }}
    >
      {profiles.map(profile => (
        <ProfileLink
          key={profile.profile_slug}
          pairSlug={pairSlug}
          profile={profile}
          active={profile.profile_slug === activeProfileSlug}
          className="flex items-center gap-2"
          dotPosition="trailing"
        />
      ))}
    </div>
  )
}

// Mobile/tablet's own switcher — the fixed side rail above has no room to
// exist below 1020px, so this is a plain in-flow, wrapping row instead of
// fixed positioning. Rendered by the caller (character-pair-detail.tsx)
// inside its own padded content column, not fixed here, since an
// in-flow element needs a real place in the layout to sit rather than
// floating over whatever happens to be underneath.
export function PairProfileMobileTabs({
  pairSlug, profiles, activeProfileSlug,
}: {
  pairSlug: string
  profiles: Profile[]
  activeProfileSlug: string
}) {
  if (profiles.length < 2) return null

  return (
    <div
      className="min-[1020px]:hidden flex flex-wrap justify-center gap-x-4 gap-y-2 font-mono text-[13px] uppercase tracking-tight"
      style={{ color: 'var(--nav-icon-color)' }}
    >
      {profiles.map(profile => (
        <ProfileLink
          key={profile.profile_slug}
          pairSlug={pairSlug}
          profile={profile}
          active={profile.profile_slug === activeProfileSlug}
          className="flex flex-col items-center gap-1"
          dotPosition="top"
        />
      ))}
    </div>
  )
}
