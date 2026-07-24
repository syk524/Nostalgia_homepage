// Concentric groove rings drawn with banded radial gradients, using the
// site's ink scale so the disc reads as a vinyl record without needing
// an image asset.
const GROOVES = `radial-gradient(circle at 50% 50%,
  #1a1918 0%, #1a1918 29%,
  #282625 29%, #282625 31%,
  #1a1918 31%, #1a1918 44%,
  #282625 44%, #282625 46%,
  #1a1918 46%, #1a1918 59%,
  #282625 59%, #282625 61%,
  #1a1918 61%, #1a1918 100%)`

export function CollapsedDisc({ isPlaying, onClick }: { isPlaying: boolean; onClick: () => void }) {
  return (
    <div className="relative w-36 sm:w-44 aspect-square">
      {/* Tonearm — fixed in place; only the disc underneath it spins. */}
      <div
        aria-hidden="true"
        className="absolute z-10 pointer-events-none"
        style={{ left: '56%', top: '38%', width: '62%', height: '3px', transformOrigin: 'left center', transform: 'rotate(-26deg)' }}
      >
        <div className="w-full h-full bg-scroll-400 rounded-full shadow" />
        <span className="absolute right-0 top-1/2 w-4 h-4 rounded-full bg-scroll-400 shadow-md -translate-y-1/2 translate-x-1/2" />
      </div>

      <button
        onClick={onClick}
        aria-label={isPlaying ? 'Pause music player' : 'Open music player'}
        className="absolute inset-0 rounded-full focus:outline-none"
      >
        <div
          className={`w-full h-full rounded-full shadow-lifted ${isPlaying ? 'animate-spin-slow' : ''}`}
          style={{ backgroundImage: GROOVES }}
        >
          <div className="absolute inset-[38%] rounded-full bg-scroll-200 shadow-inner flex items-center justify-center">
            <div className="w-[32%] h-[32%] rounded-full bg-ink-900" />
          </div>
        </div>
      </button>
    </div>
  )
}
