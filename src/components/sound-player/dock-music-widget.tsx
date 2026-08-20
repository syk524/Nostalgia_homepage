'use client'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { QueueList } from './queue-list'
import { AddTrackForm } from './add-track-form'
import type { LoopMode } from './sound-player'
import type { QueueTrack } from '@/lib/playlist'
import type { PlaylistTrack } from '@/types/database'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// The site-wide music player — a single persistent instance (owned by
// sound-player.tsx) shown on every page, right side of the screen,
// expanded by default. Dismissed by sliding the whole pill below the
// viewport rather than shrinking to a disc; a small handle stays
// anchored above the true bottom edge either way — the pill's own drag
// handle when expanded, the pull-tab that brings it back when
// collapsed. Fixed to the viewport like Nav, not part of any page's
// pannable canvas — a persistent utility, not a scattered desk object.
export function DockMusicWidget({
  collapsed,
  onToggleCollapse,
  queue,
  currentIndex,
  isPlaying,
  elapsedSeconds,
  durationSeconds,
  playError,
  loopMode,
  volume,
  userId,
  canEdit,
  onPlayPause,
  onCycleLoop,
  onVolumeChange,
  onPrev,
  onNext,
  onSelect,
  onShuffle,
  onRemove,
  onReorder,
  onTrackAdded,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  queue: QueueTrack[]
  currentIndex: number
  isPlaying: boolean
  elapsedSeconds: number
  durationSeconds: number
  playError: string | null
  loopMode: LoopMode
  volume: number
  userId: string | null
  canEdit: boolean
  onPlayPause: () => void
  onCycleLoop: () => void
  onVolumeChange: (volume: number) => void
  onPrev: () => void
  onNext: () => void
  onSelect: (index: number) => void
  onShuffle: () => void
  onRemove: (track: QueueTrack) => void
  onReorder: (reordered: QueueTrack[]) => void
  onTrackAdded: (track: PlaylistTrack) => void
}) {
  const [listOpen, setListOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const current = queue[currentIndex]

  // Must match --popout-close-dur in globals.css's .t-popout rule —
  // this is how long the "closing" phase's fade-out actually takes, so
  // the element needs to stay mounted (playing that CSS transition)
  // for exactly this long before it's safe to unmount. Unlike the old
  // conditional-render popout (which vanished the instant listOpen/
  // addOpen went false, no closing animation possible), popoutPhase
  // gives the close its own frame to play, and popoutContent keeps
  // showing whichever panel was open through that fade rather than
  // snapping to something else mid-close.
  const POPOUT_CLOSE_DUR = 150
  const [popoutPhase, setPopoutPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const [popoutContent, setPopoutContent] = useState<'list' | 'add' | 'volume'>('list')
  useEffect(() => {
    if (addOpen) { setPopoutContent('add'); setPopoutPhase('open'); return }
    if (listOpen) { setPopoutContent('list'); setPopoutPhase('open'); return }
    if (volumeOpen) { setPopoutContent('volume'); setPopoutPhase('open'); return }
    setPopoutPhase(p => (p === 'open' ? 'closing' : p))
  }, [listOpen, addOpen, volumeOpen])
  useEffect(() => {
    if (popoutPhase !== 'closing') return
    const t = setTimeout(() => setPopoutPhase('closed'), POPOUT_CLOSE_DUR)
    return () => clearTimeout(t)
  }, [popoutPhase])

  const pillRef = useRef<HTMLDivElement>(null)
  const [pillWidth, setPillWidth] = useState<number>()
  const volumeButtonRef = useRef<HTMLButtonElement>(null)
  const [volumeButtonCenter, setVolumeButtonCenter] = useState<number>()

  // Popouts (queue / add music) match the pill's own rendered width
  // exactly, rather than a guessed fixed width — the pill's width
  // shifts slightly with the "Add music" plus button (editor-only) and
  // could in principle shift with content, so this stays correct
  // instead of drifting out of sync. The volume popout instead centers
  // itself on its own button — measured here too, in the same
  // observer, since anything that shifts the pill's width (playError
  // text appearing, canEdit toggling the add button) can also shift
  // this button's own position even though its size never changes,
  // which a ResizeObserver scoped to just the button wouldn't catch.
  // offsetLeft is measured against the button's nearest positioned
  // ancestor, which is the same outer `relative z-[25]` div the popout
  // itself is absolutely positioned within below, so this value can be
  // used directly as that popout's own `left`.
  useLayoutEffect(() => {
    const el = pillRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setPillWidth(el.getBoundingClientRect().width)
      const btn = volumeButtonRef.current
      if (btn) setVolumeButtonCenter(btn.offsetLeft + btn.offsetWidth / 2)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The pill's and tag's motion is now driven entirely by declarative
  // CSS keyframe animations (see .animate-pill-collapse/-expand and
  // .animate-tag-collapse/-expand in globals.css), not hand-timed JS
  // transitions — the two used to be independently-triggered CSS
  // transitions nominally sharing a duration/delay, which could drift
  // out of sync by a frame and read as a slight gap between them. A
  // single browser-timed animation per element removes that whole
  // class of bug. TOGETHER_DURATION/ALONE_DURATION must stay in sync
  // with the 62.5%/37.5% keyframe split there (375ms / 225ms of each
  // animation's 600ms total) — they're only used here for the tag's
  // own docked/rounded-corner swap below, which (being a discrete,
  // non-interpolatable property) can't live in the keyframes
  // themselves and is instead flipped via a plain timeout landing
  // exactly when the tag is fully hidden mid-animation, so the swap
  // itself is never visible.
  const TOGETHER_DURATION = 375
  const ALONE_DURATION = 225
  const [tagDocked, setTagDocked] = useState(collapsed)
  useEffect(() => {
    const timer = setTimeout(() => setTagDocked(collapsed), collapsed ? TOGETHER_DURATION : ALONE_DURATION)
    return () => clearTimeout(timer)
  }, [collapsed])

  // Collapsing with the queue or add-music popout open used to leave it
  // marked open internally — invisible while collapsed (it rides along
  // inside the pill's own sliding wrapper), but still there waiting to
  // reappear, already open, the next time the pill expands. Forcing both
  // closed on the way down means every expand starts from the same
  // clean state.
  function handleToggleCollapse() {
    if (!collapsed) { setListOpen(false); setAddOpen(false); setVolumeOpen(false) }
    onToggleCollapse()
  }

  return (
    // z-[60] matches Nav's own reasoning for sitting above the post
    // modal's z-50 overlay — same fixed-chrome precedent, so the player
    // stays visible and usable even while a post is open, not covered
    // by the modal's full-screen bg-scroll-100 background.
    <div className="fixed bottom-0 right-6 z-[60]">
      {/* Only this inner wrapper carries the pill's own slide+fade —
          see .animate-pill-collapse/-expand in globals.css. Expanded
          rests at translateY(-42px): the tag's own height (32px) plus
          its docked-open offset (10px), landing the pill's bottom edge
          flush against the tag's top with no gap — an earlier pass
          deliberately overlapped the two, but with both being
          bg-ink-900/90 (not opaque) the overlap band composited
          slightly more opaque than its surroundings, and that band's
          edge read as a thin stray line during the animation; see the
          CSS comment for the full reasoning. Both keyframe
          animations hold the pill fully hidden (translateY(68px),
          opacity 0) through whichever portion of the shared 600ms
          timeline belongs to the tag's own solo phase — collapsing,
          that's the back 225ms (62.5%–100%, after the together-exit);
          expanding, it's the front 225ms (0%–37.5%, before the
          together-entrance) — so the pill only ever visibly moves
          during a "together" phase, on both directions. No React `key`
          here — changing animation-name alone is enough for the
          browser to restart it; forcing a remount on top of that only
          adds an extra unmount/mount cycle for no benefit. */}
      {/* relative z-25 sits between the tag's two possible z-indexes
          below — during collapse the tag never actually overlaps the
          pill spatially (see tag-collapse's own comment), so this is
          inert there; it only matters for tag-expand's new reveal,
          where the tag deliberately passes through the pill's own
          footprint to read as emerging from behind it. */}
      <div className={`relative z-[25] ${collapsed ? 'animate-pill-collapse' : 'animate-pill-expand'}`}>
      {popoutPhase !== 'closed' && popoutContent !== 'volume' && (
        <div className={`absolute bottom-full right-0 mb-3 t-popout ${popoutPhase === 'open' ? 'is-open' : ''} ${popoutPhase === 'closing' ? 'is-closing' : ''}`}>
          {popoutContent === 'add' ? (
            canEdit ? (
              <div style={{ width: pillWidth }} className="rounded-xl bg-ink-900/90 backdrop-blur-md p-4">
                <AddTrackForm
                  onClose={() => setAddOpen(false)}
                  onAdded={track => { onTrackAdded(track); setAddOpen(false) }}
                />
              </div>
            ) : (
              <div style={{ width: pillWidth }} className="rounded-xl bg-ink-900/90 backdrop-blur-md p-4 space-y-3 text-sm">
                <p className="text-scroll-100">
                  {userId ? 'You don’t have edit authority to add music.' : 'Log in with edit authority to add music.'}
                </p>
                <button onClick={() => setAddOpen(false)} className="w-full justify-center flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-scroll-100 border border-scroll-100/20 hover:border-scroll-100/40 hover:bg-scroll-100/5 transition-all duration-150">Back</button>
              </div>
            )
          ) : (
            <div style={{ width: pillWidth }} className="rounded-xl bg-ink-900/90 backdrop-blur-md p-4">
              <QueueList
                queue={queue}
                currentIndex={currentIndex}
                canEdit={canEdit}
                onSelect={onSelect}
                onRemove={onRemove}
                onReorder={onReorder}
                onAddClick={() => setAddOpen(true)}
              />
            </div>
          )}
        </div>
      )}
      {/* Separate from the list/add popout above (not a third branch of
          it) because it anchors differently: list/add hug the pill's
          right edge (right-0), sized to the pill's own width, while
          this one is a fixed 64px wide and centered on the volume
          button specifically via the measured volumeButtonCenter — an
          explicit `left` in px, not a `left-1/2 -translate-x-1/2`
          transform, since .t-popout's own `transform: scale(...)` and
          a translate utility both set the plain `transform` property on
          the same element, and .t-popout's declaration (later in the
          compiled stylesheet) silently wins, dropping the translate
          entirely — computing the centered position in px sidesteps
          that rather than fighting it. */}
      {popoutPhase !== 'closed' && popoutContent === 'volume' && volumeButtonCenter !== undefined && (
        <div
          style={{ left: volumeButtonCenter - 32 }}
          className={`absolute bottom-full mb-3 t-popout ${popoutPhase === 'open' ? 'is-open' : ''} ${popoutPhase === 'closing' ? 'is-closing' : ''}`}
        >
          <div className="w-16 rounded-xl bg-ink-900/90 backdrop-blur-md p-3 flex flex-col items-center gap-2">
            <span className="text-[11px] font-mono text-scroll-400 tabular-nums">{volume}</span>
            <div className="h-28 flex items-center justify-center">
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={e => onVolumeChange(Number(e.target.value))}
                aria-label="Volume"
                aria-orientation="vertical"
                className="volume-slider"
                // Read by the ::-webkit-slider-runnable-track gradient in
                // globals.css — WebKit has no native "filled portion"
                // concept for range inputs (unlike Firefox's own
                // ::-moz-range-progress, used as-is below), so the fill
                // is faked with a gradient hard-stopping at this value.
                style={{ '--volume-fill': `${volume}%` } as CSSProperties}
              />
            </div>
          </div>
        </div>
      )}

      <div ref={pillRef} className="flex items-center gap-3 pl-4 pr-4 py-2.5 rounded-xl bg-[#2F2F2E]">
        <div className="min-w-0 w-36 font-mono">
          <p className="text-sm text-scroll-100 truncate font-medium">{current?.title ?? 'Nothing playing'}</p>
          {playError ? (
            <p className="text-xs text-red-400 truncate">{playError}</p>
          ) : (
            <p className="text-xs text-scroll-400 truncate">{current?.artist ?? '—'}</p>
          )}
        </div>

        <div className="flex items-center gap-1 text-scroll-300">
          <button
            onClick={onPrev}
            disabled={queue.length <= 1}
            aria-label="Previous track"
            className="hover:text-scroll-100 transition-colors disabled:opacity-30 disabled:hover:text-scroll-300 disabled:cursor-not-allowed"
          >
            <SkipBack size={13} fill="currentColor" />
          </button>
          <button
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-7 h-7 rounded-full bg-scroll-100 text-ink-900 flex items-center justify-center overflow-hidden hover:opacity-90 transition-opacity"
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={isPlaying ? 'pause' : 'play'}
                initial={{ opacity: 0, scale: 0.84, rotate: isPlaying ? -8 : 8, filter: 'blur(2px)' }}
                animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.84, rotate: isPlaying ? 8 : -8, filter: 'blur(2px)' }}
                transition={{ type: 'spring', stiffness: 1000, damping: 36, mass: 0.25 }}
                className="inline-flex items-center justify-center"
              >
                {isPlaying ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" className="ml-0.5" />}
              </motion.span>
            </AnimatePresence>
          </button>
          <button
            onClick={onNext}
            disabled={queue.length <= 1}
            aria-label="Next track"
            className="hover:text-scroll-100 transition-colors disabled:opacity-30 disabled:hover:text-scroll-300 disabled:cursor-not-allowed"
          >
            <SkipForward size={13} fill="currentColor" />
          </button>
        </div>

        <span className="text-[11px] font-mono text-scroll-400 tabular-nums shrink-0">
          {formatTime(elapsedSeconds)} / {formatTime(durationSeconds)}
        </span>

        <div className="w-px h-5 bg-scroll-100/15 shrink-0" />

        <button
          onClick={onShuffle}
          aria-label="Shuffle queue"
          className="shrink-0 transition-colors text-scroll-400/40 hover:text-scroll-100"
        >
          <Shuffle size={15} />
        </button>
        <button
          onClick={onCycleLoop}
          aria-label={loopMode === 'off' ? 'Enable loop' : loopMode === 'all' ? 'Switch to loop one song' : 'Disable loop'}
          className={`shrink-0 transition-colors ${loopMode !== 'off' ? 'text-scroll-100' : 'text-scroll-400/40 hover:text-scroll-100'}`}
        >
          {loopMode === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
        </button>
        <button
          ref={volumeButtonRef}
          onClick={() => { setVolumeOpen(v => !v); setListOpen(false); setAddOpen(false) }}
          aria-label={volumeOpen ? 'Hide volume' : 'Show volume'}
          className={`shrink-0 transition-colors ${volumeOpen ? 'text-scroll-100' : 'text-scroll-400/40 hover:text-scroll-100'}`}
        >
          {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <button
          onClick={() => { setListOpen(v => !v); setAddOpen(false); setVolumeOpen(false) }}
          aria-label={listOpen ? 'Hide queue' : 'Show queue'}
          className={`shrink-0 transition-colors ${listOpen ? 'text-scroll-100' : 'text-scroll-400/40 hover:text-scroll-100'}`}
        >
          <ListMusic size={15} />
        </button>
      </div>
      </div>

      {/* Positioned independently of the sliding wrapper above (160px
          right of center — see the translateX below): this outer div
          only carries the fixed horizontal offset, so the inner button
          is free to run its own keyframe animation (see
          .animate-tag-collapse/-expand in globals.css) without the two
          transforms fighting each other. Collapsed/docked: flush at the
          true bottom edge, rounded top (it's the only thing visible,
          reads as a small tab). Open/docked: rounded bottom instead
          (its own little floating chip, no gap under the pill) and
          10px clearance from the true bottom edge. h-8 (32px) — no
          bounce/overshoot any more (see globals.css), so there's no
          longer a need for the extra headroom a taller tag once gave
          that motion. tagDocked lags the animation by design (flipped
          via the plain setTimeout above, timed to land exactly when
          the tag is mid-animation and fully hidden) — border-radius
          and the chevron glyph aren't continuously-interpolatable
          properties CSS keyframes can smoothly animate, so swapping
          them the instant they'd be visible would pop; swapping them
          off-screen instead doesn't. No React `key` here either — same
          reasoning as the pill. */}
      <div className={`absolute left-1/2 bottom-0 ${collapsed ? 'z-30' : 'z-20'}`} style={{ transform: 'translateX(calc(-50% + 160px))' }}>
        <button
          onClick={handleToggleCollapse}
          aria-label={collapsed ? 'Show music player' : 'Hide music player'}
          className={`flex items-center justify-center h-8 w-12 bg-[#2F2F2E] text-scroll-400 hover:text-scroll-100 transition-colors ${collapsed ? 'animate-tag-collapse' : 'animate-tag-expand'} ${tagDocked ? 'rounded-t-lg' : 'rounded-b-lg'}`}
        >
          {tagDocked ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
    </div>
  )
}
