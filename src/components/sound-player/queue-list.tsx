'use client'
import { Shuffle, X } from 'lucide-react'
import type { QueueTrack } from '@/lib/playlist'

export function QueueList({
  queue,
  currentIndex,
  canEdit,
  onSelect,
  onShuffle,
  onRemove,
}: {
  queue: QueueTrack[]
  currentIndex: number
  canEdit: boolean
  onSelect: (index: number) => void
  onShuffle: () => void
  onRemove: (track: QueueTrack) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-scroll-400">Up next</span>
        <button
          onClick={onShuffle}
          className="flex items-center gap-1 text-xs text-scroll-400 hover:text-scroll-100 transition-colors"
        >
          <Shuffle size={13} /> Shuffle
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {queue.map((track, i) => (
          <div
            key={track.id}
            className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
              i === currentIndex ? 'bg-scroll-100/10 text-scroll-100' : 'text-scroll-300 hover:bg-scroll-100/5'
            }`}
            onClick={() => onSelect(i)}
          >
            <span className="nav-dot shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{track.title}</div>
              <div className="truncate text-xs text-scroll-400">{track.artist}</div>
            </div>
            {canEdit && (
              <button
                onClick={e => { e.stopPropagation(); onRemove(track) }}
                aria-label="Remove from queue"
                className="opacity-0 group-hover:opacity-100 text-scroll-400 hover:text-ember transition-opacity shrink-0"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!queue.length && (
          <p className="text-xs text-scroll-400 px-2.5 py-2">No tracks yet.</p>
        )}
      </div>
    </div>
  )
}
