'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ListMusic, Music, Pause, Play, Plus, SkipBack, SkipForward } from 'lucide-react'
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
  userId,
  canEdit,
  onPlayPause,
  onPrev,
  onNext,
  onSelect,
  onShuffle,
  onRemove,
  onTrackAdded,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  queue: QueueTrack[]
  currentIndex: number
  isPlaying: boolean
  elapsedSeconds: number
  loopMode: LoopMode
  userId: string | null
  canEdit: boolean
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  onSelect: (index: number) => void
  onShuffle: () => void
  onRemove: (track: QueueTrack) => void
  onTrackAdded: (track: PlaylistTrack) => void
}) {
  const [listOpen, setListOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const current = queue[currentIndex]

  const pillRef = useRef<HTMLDivElement>(null)
  const [pillWidth, setPillWidth] = useState<number>()

  // Popouts (queue / add music) match the pill's own rendered width
  // exactly, rather than a guessed fixed width — the pill's width
  // shifts slightly with the "Add music" plus button (editor-only) and
  // could in principle shift with content, so this stays correct
  // instead of drifting out of sync.
  useLayoutEffect(() => {
    const el = pillRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setPillWidth(el.getBoundingClientRect().width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="fixed bottom-0 right-6 z-40">
      {/* Only this inner wrapper slides. Expanded lifts the pill up by
          the tab's own height (28px) plus its own bottom-[10px] offset
          (38px), landing its bottom edge flush against the tab's top —
          no gap between them. Collapsed uses translateY(100%) measured
          from the pill's natural (untransformed, tab-height-lower)
          position — that's exactly its own height, so it still lands
          fully below the outer wrapper's bottom-0 edge regardless of
          the expanded-state offset. The tab is a sibling, not a
          descendant, so it's untouched by this transform and stays
          flush at the true bottom edge in both states. */}
      <div className="transition-transform duration-300 ease-out" style={{ transform: `translateY(${collapsed ? '100%' : '-38px'})` }}>
      {(listOpen || addOpen) && (
        <div className="absolute bottom-full right-0 mb-3">
          {addOpen ? (
            canEdit ? (
              <div style={{ width: pillWidth }} className="rounded-2xl bg-ink-900/90 backdrop-blur-md p-4">
                <AddTrackForm
                  onClose={() => setAddOpen(false)}
                  onAdded={track => { onTrackAdded(track); setAddOpen(false) }}
                />
              </div>
            ) : (
              <div style={{ width: pillWidth }} className="rounded-2xl bg-ink-900/90 backdrop-blur-md p-4 space-y-3 text-sm">
                <p className="text-scroll-100">
                  {userId ? 'You don’t have edit authority to add music.' : 'Log in with edit authority to add music.'}
                </p>
                <button onClick={() => setAddOpen(false)} className="w-full justify-center flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-scroll-100 border border-scroll-100/20 hover:border-scroll-100/40 hover:bg-scroll-100/5 transition-all duration-150">Back</button>
              </div>
            )
          ) : (
            <div style={{ width: pillWidth }} className="rounded-2xl bg-ink-900/90 backdrop-blur-md p-4">
              <QueueList
                queue={queue}
                currentIndex={currentIndex}
                canEdit={canEdit}
                onSelect={onSelect}
                onShuffle={onShuffle}
                onRemove={onRemove}
              />
            </div>
          )}
        </div>
      )}

      <div ref={pillRef} className="flex items-center gap-3 pl-2.5 pr-4 py-2.5 rounded-full bg-ink-900/90 backdrop-blur-md">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#282625' }}>
          <Music size={16} className="text-scroll-100" />
        </div>

        <div className="min-w-0 w-36">
          <p className="text-sm text-scroll-100 truncate font-medium">{current?.title ?? 'Nothing playing'}</p>
          <p className="text-xs text-scroll-400 truncate">{current?.artist ?? '—'}</p>
        </div>

        <div className="flex items-center gap-1 text-scroll-300">
          <button onClick={onPrev} aria-label="Previous track" className="hover:text-scroll-100 transition-colors">
            <SkipBack size={15} />
          </button>
          <button
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-7 h-7 rounded-full bg-scroll-100 text-ink-900 flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
          </button>
          <button onClick={onNext} aria-label="Next track" className="hover:text-scroll-100 transition-colors">
            <SkipForward size={15} />
          </button>
        </div>

        <span className="text-[11px] font-mono text-scroll-400 tabular-nums shrink-0">
          {formatTime(elapsedSeconds)}{current?.duration_seconds ? ` / ${formatTime(current.duration_seconds)}` : ''}
        </span>

        <div className="w-px h-5 bg-scroll-100/15 shrink-0" />

        <button
          onClick={() => { setListOpen(v => !v); setAddOpen(false) }}
          aria-label={listOpen ? 'Hide queue' : 'Show queue'}
          className={`shrink-0 transition-colors ${listOpen ? 'text-scroll-100' : 'text-scroll-400 hover:text-scroll-100'}`}
        >
          <ListMusic size={15} />
        </button>
        {canEdit && (
          <button
            onClick={() => { setAddOpen(v => !v); setListOpen(false) }}
            aria-label={addOpen ? 'Close add music' : 'Add music'}
            className={`shrink-0 transition-colors ${addOpen ? 'text-scroll-100' : 'text-scroll-400 hover:text-scroll-100'}`}
          >
            <Plus size={15} />
          </button>
        )}
      </div>
      </div>

      {/* Absolute, not a descendant of the sliding wrapper above — stays
          put at the edge regardless of collapsed state. Collapsed: flush
          at the true bottom edge, rounded top (it's the only thing
          visible, reads as a small tab). Open: rounded bottom instead
          (it now reads as its own little floating chip, with a visible
          gap above it under the pill) and 10px clearance from the true
          bottom edge. */}
      <button
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Show music player' : 'Hide music player'}
        className={`absolute left-1/2 -translate-x-1/2 flex items-center justify-center h-7 w-12 bg-ink-900/90 backdrop-blur-md text-scroll-400 hover:text-scroll-100 transition-colors ${collapsed ? 'bottom-0 rounded-t-lg' : 'bottom-[10px] rounded-b-lg'}`}
      >
        {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    </div>
  )
}
