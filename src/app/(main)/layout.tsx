import { createClient } from '@/lib/supabase/server'
import { Nav } from '@/components/nav'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase.from('profiles').select('*').eq('id', user.id).single()).data
    : null

  return (
    <div className="relative min-h-screen overflow-hidden bg-scroll-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 w-full h-full opacity-[0.05] bg-[length:28px_28px] bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)]"
      />
      <div className="relative">
        <Nav profile={profile} />
        <main className="max-w-5xl mx-auto px-6 pt-24 pb-16">{children}</main>
      </div>
    </div>
  )
}
