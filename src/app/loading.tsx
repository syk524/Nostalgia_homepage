import { DotMatrixLoader } from '@/components/dot-matrix-loader'

// Next.js's built-in loading UI — automatically shown in place of any
// route's content while that route's async Server Component (page.tsx
// awaiting Supabase queries, etc.) is still resolving, no manual
// Suspense wiring needed. Root-level, so it covers every route.
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <DotMatrixLoader size={40} />
    </div>
  )
}
