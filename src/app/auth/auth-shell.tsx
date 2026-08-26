import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function AuthShell({ tagline, children }: { tagline?: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 w-full h-full opacity-[0.05] bg-[length:28px_28px] bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)]"
      />

      {/* Same fixed top-left corner spot Nav's own chrome uses elsewhere
          (see character-pair-detail.tsx's back-to-Profile link) —
          consistent placement for "leave this page" across the site. */}
      <Link
        href="/"
        aria-label="Back to home"
        className="fixed left-[2.6%] top-[3%] z-[60] inline-flex w-8 h-8 rounded-full items-center justify-start text-ink-500 hover:text-ink transition-colors"
      >
        <ArrowLeft size={18} />
      </Link>

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <Link href="/" className="font-mono text-2xl uppercase tracking-tight" style={{ color: 'var(--theme-accent)' }}>
            Nustalgio
          </Link>
          {tagline && <p className="text-ink-500 text-sm mt-2">{tagline}</p>}
        </div>

        <div className="card p-8">{children}</div>
      </div>
    </div>
  )
}
