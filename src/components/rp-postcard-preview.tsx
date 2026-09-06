'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { RpMessage } from '@/types/database'
import { italicizeParens } from '@/components/rp-conversation'

// New "postcard" visualization for the RP list's thumbnail — kept as a
// separate component rather than replacing RpThumbnailPreview, per direct
// request to keep that earlier rolling-chat-log version in reserve rather
// than deleting it, in case this one doesn't work out. Reference:
// postcardreview.framer.website (a testimonial-postcard layout) — quote
// text swapped for a random short excerpt of the post's own conversation
// in a two-column script format (name left, line right), address block
// reduced to the post's own title, signature line dropped, per direct
// answers to clarifying questions.
const EXCERPT_MAX_LEN = 3
const EXCERPT_LENGTH_BUDGET = 180
// Floor for the shrink-to-fit effect below — a message cut down this far
// is essentially unreadable, so it stops trying past this point rather
// than reducing forever.
const LINE_MIN_CHARS = 20
const LINE_SHRINK_STEP = 15

const STAMP_IMAGES = ['/rp-stamps/nustalgio-1.png', '/rp-stamps/nustalgio-2.png', '/rp-stamps/nustalgio-3.png']

function stripImages(html: string): string {
  return html.replace(/<img[^>]*>/g, '')
}

function stripAllTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

// Truncates the PLAIN text (tags already stripped) at a word boundary,
// then re-applies paren-italicizing to the truncated result — done in
// that order, not the reverse, since cutting mid-HTML-tag would leave
// broken markup for dangerouslySetInnerHTML.
function truncateForDisplay(html: string, maxChars: number): string {
  const plain = stripAllTags(html)
  if (plain.length <= maxChars) return italicizeParens(html)
  const cut = plain.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  const trimmed = (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()
  return italicizeParens(`${trimmed}…`)
}

// A random CONTIGUOUS run of real dialogue (never crossing into a
// divider's own section title) — 3 messages by default, trimmed to 2 if
// their combined length would run long on a card this size. The
// shrink-to-fit effect below (shownCount/lastCap) still catches whatever
// this doesn't, since actual wrapped-line count depends on the card's
// real rendered width, not just character count.
function pickExcerpt(messages: RpMessage[]): RpMessage[] {
  const runs: [number, number][] = []
  let runStart: number | null = null
  for (let i = 0; i <= messages.length; i++) {
    const isDivider = i === messages.length || messages[i].type === 'divider'
    if (!isDivider && runStart === null) runStart = i
    if (isDivider && runStart !== null) {
      runs.push([runStart, i])
      runStart = null
    }
  }
  if (!runs.length) return []
  const [start, end] = runs[Math.floor(Math.random() * runs.length)]
  const runLength = end - start
  const want = Math.min(EXCERPT_MAX_LEN, runLength)
  const from = start + Math.floor(Math.random() * (runLength - want + 1))
  let excerpt = messages.slice(from, from + want)
  const totalLength = excerpt.reduce((sum, m) => sum + stripImages(m.html).replace(/<[^>]+>/g, '').length, 0)
  if (excerpt.length > 2 && totalLength > EXCERPT_LENGTH_BUDGET) excerpt = excerpt.slice(0, 2)
  return excerpt
}

export function RpPostcardPreview({
  title,
  messages,
  index,
  total,
  active,
}: {
  title: string
  messages: RpMessage[]
  index: number
  total: number
  active: boolean
}) {
  const wasActive = useRef(false)
  const scriptRef = useRef<HTMLDivElement>(null)
  // Deterministic (first real messages, no Math.random()) on first
  // render so server and client agree — a client component still renders
  // once server-side, and picking a random excerpt there would almost
  // never match the client's own random pick during hydration, producing
  // a real hydration-mismatch warning (confirmed in the console the
  // first time this called pickExcerpt inline in a useState initializer
  // — the exact same mistake, and fix, as RpThumbnailPreview's own
  // startIndex logic earlier). The effect below does the actual
  // randomizing, client-only, immediately after mount.
  const [excerpt, setExcerpt] = useState<RpMessage[]>(() =>
    messages.slice(0, Math.min(EXCERPT_MAX_LEN, messages.length)).filter(m => m.type !== 'divider')
  )
  // How many of `excerpt` are actually shown, and how hard the LAST
  // shown one gets truncated — both start at "show everything, cut
  // nothing" on a fresh excerpt and only shrink if the real rendered
  // content overflows the card's own fixed height (see the layout effect
  // below). lastCap null means "no cap yet" — every message renders at
  // its own full length until measurement proves that doesn't fit,
  // rather than pre-emptively cutting every line to some fixed length
  // regardless of whether the card actually had room for it (reported
  // directly: a message was getting a word chopped off even though it
  // visibly still fit inside the card). Postcards stay one consistent
  // SIZE regardless of what's on them, per direct request ("fix the
  // postcard height across posts") — rather than growing the card to
  // fit, the CONTENT shrinks to fit the card: dropping to fewer messages
  // first, then truncating whichever message is now last, instead of
  // letting anything spill past the edge.
  const [shownCount, setShownCount] = useState(excerpt.length)
  const [lastCap, setLastCap] = useState<number | null>(null)

  // Re-randomizes only when this post is *recalled* to the screen (an
  // inactive→active edge, including the very first time it's shown) —
  // fresh excerpt every time you swipe back to this post, but not
  // spontaneously while it's just sitting there being viewed.
  useEffect(() => {
    const recalled = active && !wasActive.current
    wasActive.current = active
    if (!recalled) return
    const next = pickExcerpt(messages)
    setExcerpt(next)
    setShownCount(next.length)
    setLastCap(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const visible = excerpt.slice(0, shownCount)
  const lastVisible = visible[visible.length - 1]

  useLayoutEffect(() => {
    const el = scriptRef.current
    if (!el || !lastVisible) return
    if (el.scrollHeight > el.clientHeight + 1) {
      if (shownCount > 1) {
        setShownCount(c => c - 1)
        return
      }
      // Only one message left and it still overflows — start shrinking
      // it from its OWN current length (not some arbitrary constant), so
      // the very first cut is as small as possible.
      const currentLength = lastCap ?? stripAllTags(stripImages(lastVisible.html)).length
      if (currentLength > LINE_MIN_CHARS) setLastCap(Math.max(LINE_MIN_CHARS, currentLength - LINE_SHRINK_STEP))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length, lastCap, shownCount, lastVisible?.html])

  const stamp = STAMP_IMAGES[index % STAMP_IMAGES.length]

  return (
    // Fixed size (from the deck's own reserved box, via w-full/h-full —
    // no aspect-ratio or min-height here, unlike an earlier version:
    // confirmed live that aspect-ratio on a plain block element computes
    // a genuinely FIXED used height from width rather than a preferred
    // one, so it never actually grew for longer content; a min-height
    // did grow, but that meant every post's card was a different size.
    // overflow-hidden is a backstop for the brief window before the
    // shrink-to-fit effect above settles, not the primary mechanism.
    <div
      className="w-full h-full flex flex-col overflow-hidden p-6 min-[520px]:p-8"
      style={{ backgroundColor: '#FBFBF9', border: '1px solid rgba(30,26,20,0.18)', boxShadow: '0 18px 40px -16px rgba(30,26,20,0.35)' }}
    >
      <div className="flex items-baseline gap-3 pb-3 border-b border-[rgba(30,26,20,0.25)]">
        <span className="flex-1" />
        <span
          className="text-lg min-[520px]:text-xl italic"
          style={{ fontFamily: 'var(--font-chosun-nm), Georgia, serif', color: '#5c5240' }}
        >
          {title}
        </span>
      </div>

      <div className="flex-1 flex gap-5 min-[520px]:gap-7 pt-4 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div ref={scriptRef} className="flex-1 flex flex-col justify-center gap-3 min-[520px]:gap-4 overflow-hidden">
            {visible.map((m, i) => (
              <div key={i} className="flex gap-3 items-baseline">
                <span
                  className="shrink-0 w-12 min-[520px]:w-14 text-[11px] min-[520px]:text-[13px] font-semibold tracking-wide"
                  style={{ color: '#4a4030' }}
                >
                  {m.name}
                </span>
                <span
                  className="text-[12px] min-[520px]:text-[14px] leading-relaxed"
                  style={{ color: '#2e2a20' }}
                  dangerouslySetInnerHTML={{
                    __html: truncateForDisplay(stripImages(m.html), i === visible.length - 1 ? (lastCap ?? Infinity) : Infinity),
                  }}
                />
              </div>
            ))}
          </div>
          <p className="pt-3 mt-3 text-[10px] min-[520px]:text-xs tracking-[0.2em] text-[#8a7f6c] border-t border-dashed border-[rgba(30,26,20,0.25)]">
            No. {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </p>
        </div>

        <div className="w-20 min-[520px]:w-28 shrink-0 flex flex-col items-center border-l border-dashed border-[rgba(30,26,20,0.3)] pl-5 min-[520px]:pl-7">
          <div className="relative w-full aspect-[3/4] border border-dashed border-[rgba(30,26,20,0.4)] p-1">
            <div className="relative w-full h-full overflow-hidden">
              <Image src={stamp} alt="" fill sizes="120px" className="object-cover" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
