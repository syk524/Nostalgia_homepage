import Link from 'next/link'

export function AuthShell({ tagline, children }: { tagline: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-scroll-100 flex items-center justify-center px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 w-full h-full opacity-[0.05] bg-[length:28px_28px] bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)]"
      />

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <Link href="/" className="font-mono text-2xl uppercase tracking-tight text-ink">
            Nostalgia
          </Link>
          <p className="text-ink-500 text-sm mt-2">{tagline}</p>
        </div>

        <div className="card p-8">{children}</div>
      </div>
    </div>
  )
}
