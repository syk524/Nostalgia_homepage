import { Music } from 'lucide-react'
import { pairFontFamily } from '@/lib/fonts'

// Optional link rendered right below the pair title — 8px gap (mt-2),
// same font size as a character's catchphrase (11px), user-selectable
// font/color. target="_blank" opens it in a new page (rel="noopener
// noreferrer" so the new page can't reach back to window.opener).
// Hover widens letter-spacing to 1.05x (tracking-normal is 0, so the
// "widened" value is expressed directly as 0.05em — 5% of the font size,
// the same "letter-spacing as a fraction of font size" convention used
// for the catchphrase elsewhere in this file). Duration/easing match
// animate-slide-up's cubic-bezier in globals.css — this app's established
// "smooth" curve — rather than the plain linear default.
export function PairLink({
  text, url, font, color, hasMusic, centered,
}: {
  text: string | null
  url: string | null
  font: string
  color: string
  hasMusic: boolean
  centered?: boolean
}) {
  if (!text || !url) return null
  return (
    <div className={`mt-2 ${centered ? 'text-center' : ''}`}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 tracking-normal hover:tracking-[0.05em] transition-[letter-spacing] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ fontFamily: pairFontFamily(font), color, fontSize: 11 }}
      >
        {hasMusic && <Music size={11} />}
        <span>{text}</span>
      </a>
    </div>
  )
}
