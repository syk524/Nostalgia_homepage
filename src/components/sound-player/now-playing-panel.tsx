'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Pause, Play, Plus, Repeat, Repeat1, SkipBack, SkipForward } from 'lucide-react'
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

export function NowPlayingPanel({
  queue,
  currentIndex,
  isPlaying,
  elapsedSeconds,
  loopMode,
  userId,
  canEdit,
  onPlayPause,
  onPrev,
  onNext,
  onSelect,
  onShuffle,
  onCycleLoopMode,
  onRemove,
  onTrackAdded,
}: {
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
  onCycleLoopMode: () => void
  onRemove: (track: QueueTrack) => void
  onTrackAdded: (track: PlaylistTrack) => void
}) {
  const [listOpen, setListOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const current = queue[currentIndex]

  if (addOpen) {
    if (canEdit) {
      return (
        <div className="retro-frame w-72">
          <div className="retro-inner p-4">
            <AddTrackForm
              onClose={() => setAddOpen(false)}
              onAdded={track => { onTrackAdded(track); setAddOpen(false) }}
            />
          </div>
        </div>
      )
    }
    return (
      <div className="retro-frame w-72">
        <div className="retro-inner p-4 space-y-3 text-sm">
          {userId ? (
            <p className="text-white/70">You don&apos;t have edit authority to add music.</p>
          ) : (
            <>
              <p className="text-white/70">Log in with edit authority to add music.</p>
              <Link href="/auth/login" className="btn-primary w-full justify-center text-sm">Log In</Link>
            </>
          )}
          <button onClick={() => setAddOpen(false)} className="btn-ghost w-full justify-center text-sm !text-white/70 !border-white/20 hover:!border-white/40 hover:!bg-white/5">Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="retro-frame w-72">
      <div className="retro-inner p-4 space-y-4 font-mono">
        <div className="relative">
          <div className="lcd-screen space-y-0.5 pr-7">
            <div className="truncate">&#9834; {current?.title ?? 'Nothing playing'}</div>
            <div className="truncate opacity-70">&#128100; {current?.artist ?? '—'}</div>
            <div className="opacity-70">&#9654; {formatTime(elapsedSeconds)}</div>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            aria-label="Add music"
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Click wheel — an original circular transport control (not a copy of
            any particular device's shell): MENU/prev/next/loop around the
            rim, play/pause as the center hub. */}
        <div className="mx-auto w-44 h-44 relative rounded-full bg-[radial-gradient(circle_at_35%_30%,#232227_0%,#151417_60%,#0b0b0d_100%)] shadow-lifted">
          <button
            onClick={() => setListOpen(v => !v)}
            aria-label={listOpen ? 'Hide track list' : 'Show track list'}
            className="retro-label absolute top-4 left-1/2 -translate-x-1/2 text-white/50 hover:text-white"
          >
            MENU
          </button>

          <button
            onClick={onPrev}
            aria-label="Previous track"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={onNext}
            aria-label="Next track"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
          >
            <SkipForward size={18} />
          </button>

          <button
            onClick={onCycleLoopMode}
            aria-label={
              loopMode === 'off' ? 'Enable loop' : loopMode === 'all' ? 'Loop all — click for loop one' : 'Looping current song'
            }
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 transition-colors ${loopMode !== 'off' ? 'text-white' : 'text-white/35 hover:text-white/60'}`}
          >
            {loopMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>

          <button
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="knob-btn absolute inset-0 m-auto w-16 h-16 bg-white text-ink active:scale-[0.98]"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
        </div>

        {listOpen && (
          <QueueList
            queue={queue}
            currentIndex={currentIndex}
            canEdit={canEdit}
            onSelect={onSelect}
            onShuffle={onShuffle}
            onRemove={onRemove}
          />
        )}
      </div>
    </div>
  )
}
