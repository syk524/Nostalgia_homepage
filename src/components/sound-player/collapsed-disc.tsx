'use client'
import { Pause, Play } from 'lucide-react'

// Mirrors the click-wheel's own gradient language so the collapsed and
// expanded states read as the same object, just zoomed in/out.
export function CollapsedDisc({ isPlaying, onClick }: { isPlaying: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={isPlaying ? 'Pause music player' : 'Open music player'}
      className="relative w-16 h-16 rounded-full shadow-lifted focus:outline-none"
      style={{ backgroundImage: `radial-gradient(circle at 35% 30%, #232227 0%, #151417 60%, #0b0b0d 100%)` }}
    >
      {isPlaying && (
        <span className="absolute inset-0 rounded-full animate-ping bg-white/10" aria-hidden="true" />
      )}
      <div className="knob-btn absolute inset-0 m-auto w-9 h-9 bg-white text-ink">
        {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </div>
    </button>
  )
}
