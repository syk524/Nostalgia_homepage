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
        <AddTrackForm
          onClose={() => setAddOpen(false)}
          onAdded={track => { onTrackAdded(track); setAddOpen(false) }}
        />
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
        <div className="flex items-center gap-3">
          <div className="lcd-screen flex-1 min-w-0 space-y-0.5">
            <div className="truncate">&#9834; {current?.title ?? 'Nothing playing'}</div>
            <div className="truncate opacity-70">&#128100; {current?.artist ?? '—'}</div>
            <div className="opacity-70">&#9654; {formatTime(elapsedSeconds)}</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-5">
          <button onClick={onPrev} aria-label="Previous track" className="knob-btn w-9 h-9 bg-white/10 text-white/70 hover:text-white">
            <SkipBack size={16} />
          </button>
          <button
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="knob-btn w-12 h-12 bg-white text-ink active:scale-[0.98]"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button onClick={onNext} aria-label="Next track" className="knob-btn w-9 h-9 bg-white/10 text-white/70 hover:text-white">
            <SkipForward size={16} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => setAddOpen(true)} className="retro-label text-white/60 hover:text-white">
            <Plus size={12} /> Add music
          </button>
          <button
            onClick={onCycleLoopMode}
            aria-label={
              loopMode === 'off' ? 'Enable loop' : loopMode === 'all' ? 'Loop all — click for loop one' : 'Looping current song'
            }
            className={`retro-label ${loopMode !== 'off' ? 'text-white' : 'text-white/35'}`}
          >
            {loopMode === 'one' ? <Repeat1 size={12} /> : <Repeat size={12} />}
            Loop
          </button>
          <button onClick={() => setListOpen(v => !v)} className="retro-label text-white/60 hover:text-white">
            {listOpen ? 'Hide list' : 'See list'}
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
