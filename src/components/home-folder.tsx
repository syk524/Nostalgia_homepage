import { Sparkles } from 'lucide-react'

// A small decorative "folder" in the home page's empty right-hand space —
// a flat card at rest that tilts open on hover (perspective on the direct
// parent of the rotating cover, hinged at its left edge via origin-left)
// to reveal a paper sliver tucked behind it. Pure CSS (group-hover), no
// client JS needed — this also gets the animation "for free" on touch by
// falling back to a tap-and-hold rather than needing separate tap-state
// wiring. duration-500 + the cubic-bezier reuse this app's established
// "smooth" motion curve (see .animate-slide-up in globals.css).
export function HomeFolder() {
  return (
    <div className="group hidden md:block absolute right-[8%] top-1/2 -translate-y-1/2 -rotate-[3deg]">
      <div className="relative w-[150px] h-[190px]" style={{ perspective: 900 }}>
        {/* Paper tucked behind the cover — only its right edge (a vertical
            label) is meant to peek out once the cover rotates away. */}
        <div className="absolute inset-0 rounded-xl bg-scroll-50 border border-scroll-300 shadow-parchment flex items-center justify-end pr-2.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-ink-400 [writing-mode:vertical-rl]">
            Do not open
          </span>
        </div>

        {/* Folder cover — hinges open on hover, staying flat at rest. */}
        <div
          className="absolute inset-0 rounded-xl shadow-parchment p-4 flex flex-col justify-between origin-left transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:[transform:rotateY(-26deg)]"
          style={{ background: 'linear-gradient(155deg, #6b6864 0%, #282625 100%)' }}
        >
          <Sparkles size={18} className="text-scroll-100" />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wide text-scroll-100">Personal Archive</p>
            <p className="font-mono text-[9px] text-scroll-400 mt-0.5">Handle with care</p>
          </div>
        </div>
      </div>
    </div>
  )
}
