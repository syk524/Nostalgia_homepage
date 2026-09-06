'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { RpMessage } from '@/types/database'
import { NAME_STYLE, SPEAKER_COLORS, italicizeParens } from '@/components/rp-conversation'

// The deck card used to show each post's cover_url photo, then a static
// random few-line snippet — replaced with a continuously rolling readout
// of the actual log: one new message fades/slides in from the bottom,
// pushing everything already shown up, so the thumbnail reads like a
// little chat log playing on its own rather than a fixed snapshot.
//
// How long each message stays up before the next one rolls in is
// proportional to its own length (estimateRollDelay), not a flat
// interval — reported directly ("it's too fast now"): a one-line message
// and a six-line paragraph were getting the same amount of time, which
// read as rushed for anything long. ROLL_MS_PER_CHAR is a rough Korean
// reading-pace estimate, not a precise one; ROLL_MIN_MS/ROLL_MAX_MS just
// keep very short or very long messages from feeling instant or endless.
const ROLL_MIN_MS = 4500
const ROLL_MAX_MS = 10000
const ROLL_MS_PER_CHAR = 60

function estimateRollDelay(html: string): number {
  const plainLength = html.replace(/<[^>]+>/g, '').length
  return Math.min(ROLL_MAX_MS, Math.max(ROLL_MIN_MS, plainLength * ROLL_MS_PER_CHAR))
}

// Safety ceiling on how many messages can ever stack up at once,
// independent of the real per-message overflow check below — in case
// that check ever misses a beat (this is exactly what happened with
// framer-motion's `layout` prop, since removed: it briefly switches an
// animating element to `position: absolute` for its own FLIP
// measurement, pulling it out of normal flow and making it invisible to
// scrollHeight — confirmed live, the stack grew to 20+ messages spilling
// well past the card instead of trimming). Trimming here still only ever
// drops ONE (the oldest) per tick, same as the real overflow check below
// — the whole conversation is never wiped at once, just the single
// message that's aged out, continuously, as each new one rolls in.
const MAX_SHOWN = 10

function stripImages(html: string): string {
  return html.replace(/<img[^>]*>/g, '')
}

// A divider (see RpConversation's own comment) is a section title, not a
// line of dialogue with an avatar and colored bubble — this preview
// skips it entirely rather than rendering a broken-looking empty bubble
// for it. Wraps around at most once, so a post that somehow ended up all
// dividers doesn't loop forever.
function nextRealIndex(messages: RpMessage[], from: number): number {
  let i = from
  for (let steps = 0; steps < messages.length; steps++) {
    if (messages[i]?.type !== 'divider') return i
    i = (i + 1) % messages.length
  }
  return from
}

export function RpThumbnailPreview({ messages, active }: { messages: RpMessage[]; active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nextKey = useRef(0)
  // Starts false regardless of this post's real initial `active` value —
  // an inactive→active edge is detected below by comparing against this,
  // so a post that's active from its very first render (index 0, on
  // initial page load) still counts as just having been "recalled" and
  // gets its own fresh random start, same as any later one.
  const wasActive = useRef(false)
  // Deterministic (index 0) on first render so server and client agree —
  // a client component still renders once server-side, and picking
  // Math.random() there would almost never match the client's own random
  // pick during hydration, producing a real hydration-mismatch warning
  // (confirmed in the console the first time this called Math.random()
  // inline in a useState initializer). The effect below does the actual
  // randomizing, client-only, immediately after mount.
  const [shown, setShown] = useState<{ key: number; msgIndex: number }[]>(() =>
    messages.length ? [{ key: 0, msgIndex: nextRealIndex(messages, 0) }] : []
  )

  // Re-randomizes every time this post is *recalled* to the screen — an
  // inactive→active edge, i.e. switching away to another post and back —
  // but not spontaneously while it just sits there being viewed or
  // ticking along in the background while inactive. Reported directly:
  // moving from 0차 to 1차 and back to 0차 should start 0차's readout over
  // from a new random point, but nothing should reset on its own before
  // the user actually switches to a different post. This replaces an
  // earlier "randomize exactly once, ever" version — reported directly
  // as too sticky, since revisiting a post never gave it a fresh start
  // again after the first time.
  useEffect(() => {
    const recalled = active && !wasActive.current
    wasActive.current = active
    if (!recalled || !messages.length) return
    nextKey.current = 0
    setShown([{ key: 0, msgIndex: nextRealIndex(messages, Math.floor(Math.random() * messages.length)) }])
  }, [active, messages.length])

  // Only the active (visible) card actually rolls forward — an inactive
  // one just sits on whatever it last showed instead of burning timers
  // offscreen. Re-armed off lastKey (the newest message's own key), not
  // off `shown` as a whole — the trim effect below also changes `shown`
  // (by dropping the oldest), and re-timing off that too would restart
  // this countdown every time something aged out at the *other* end,
  // even though the just-shown message's own reading time hasn't
  // actually elapsed yet.
  const lastShown = shown[shown.length - 1]
  const lastKey = lastShown?.key
  useEffect(() => {
    if (!active || messages.length < 2 || lastShown === undefined) return
    const delay = estimateRollDelay(messages[lastShown.msgIndex].html)
    const id = setTimeout(() => {
      setShown(prev => {
        const last = prev[prev.length - 1]
        nextKey.current += 1
        const nextIndex = nextRealIndex(messages, (last.msgIndex + 1) % messages.length)
        const next = [...prev, { key: nextKey.current, msgIndex: nextIndex }]
        return next.length > MAX_SHOWN ? next.slice(1) : next
      })
    }, delay)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, messages.length, lastKey])

  // Drops the oldest message only once it has scrolled ENTIRELY past the
  // card's own top edge — not merely once the stack as a whole is a
  // little taller than the card. Reported directly: removing it as soon
  // as the total height went over cut a message's own exit short while
  // it was still partway visible. overflow-hidden already makes anything
  // past the edge invisible on its own; this just cleans the fully-gone
  // one out of the DOM afterward instead of before.
  //
  // settling guards against this effect re-triggering itself: removing
  // one message is itself a `shown` change, so without the guard, this
  // effect fires again immediately afterward and — if a second message
  // also happens to already be fully past the edge (several short ones
  // can cluster right at the boundary) — removes that one too, then the
  // next, all within the same render flush before the next roll even
  // happens. Reported directly as "deleting 4 messages at the same time"
  // instead of one. The guard caps it at exactly one removal per new
  // message rolling in: a removal it caused itself is absorbed here and
  // skipped, so any further backlog waits for the *next* addition instead
  // of draining all at once.
  const settling = useRef(false)
  useLayoutEffect(() => {
    if (settling.current) {
      settling.current = false
      return
    }
    const el = containerRef.current
    const first = el?.firstElementChild
    if (!el || !first || shown.length < 2) return
    if (first.getBoundingClientRect().bottom <= el.getBoundingClientRect().top) {
      settling.current = true
      setShown(prev => prev.slice(1))
    }
  }, [shown])

  if (!messages.length) {
    return (
      <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-scroll-300 text-scroll-400 text-4xl">
        ◯
      </div>
    )
  }

  const speakerOrder: string[] = []
  for (const m of messages) {
    if (m.type === 'divider') continue
    if (!speakerOrder.includes(m.name)) speakerOrder.push(m.name)
  }

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col justify-end gap-3 px-4 py-6 overflow-hidden">
      <AnimatePresence initial={false}>
        {shown.map(({ key, msgIndex }) => {
          const m = messages[msgIndex]
          const speakerIndex = speakerOrder.indexOf(m.name)
          const style = NAME_STYLE[m.name]
          const isRight = style ? style.side === 'right' : speakerIndex % 2 === 1
          const color = style ? style.color : SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length]
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 16 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { y: { duration: 0.25, ease: 'easeOut' }, opacity: { duration: 0.25, ease: 'easeOut', delay: 0.25 } },
              }}
              exit={{ opacity: 0, y: -16, transition: { duration: 0.45, ease: 'easeOut' } }}
              className={`flex items-start gap-1.5 ${isRight ? 'flex-row-reverse' : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- same
                  external-avatar reasoning as RpConversation's own img tag */}
              <img src={m.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
              <div
                className="rounded-[6px] px-3 py-2 text-[13px] leading-snug text-ink max-w-[75%]"
                style={{ backgroundColor: color }}
                dangerouslySetInnerHTML={{ __html: italicizeParens(stripImages(m.html)) }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
