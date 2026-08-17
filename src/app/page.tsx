import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data
    : null

  return (
    <div className="relative min-h-screen overflow-hidden bg-scroll-100">
      {/* decorative grid background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 w-full h-full opacity-[0.05] bg-[length:28px_28px] bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)]"
      />

      <Suspense fallback={null}>
        <Nav profile={profile} categories={[]} />
      </Suspense>

      {/* wordmark */}
      <div className="absolute left-1/2 top-1/2 w-[42%] max-w-[640px] -translate-x-1/2 -translate-y-1/2">
        <img src="/images/nostalgio-wordmark.png" alt="Nostalgia" className="w-full" />
      </div>
    </div>
  )
}
