import { DotMatrixLoader } from '@/components/dot-matrix-loader'
import { IllustLoadingBg } from '@/components/illust-loading-bg'

// Next.js's built-in loading UI — automatically shown in place of any
// route's content while that route's async Server Component (page.tsx
// awaiting Supabase queries, etc.) is still resolving, no manual
// Suspense wiring needed. Root-level, so it covers every route.
//
// IllustLoadingBg included here too, per direct request — without it, an
// Illust visitor saw flat solid black (body's own --theme-bg) for however
// long a route took to resolve, then a hard cut to the blurred
// illustration once (main)/layout.tsx's own copy mounted. It's pathname-
// aware (skips the backdrop entirely when heading to the home scene,
// which wants no blur at all) rather than the plain IllustPageBg other
// callers use — see that component's own comment.
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <IllustLoadingBg />
      <DotMatrixLoader size={40} />
    </div>
  )
}
