import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes only shown to guests (redirect logged-in users away)
const AUTH_PAGES = ['/auth/login', '/auth/register']

// Routes viewable by everyone, guests included. Gallery browsing/reading is
// public; creating and editing posts requires a session (checked below).
// The profile grid is public too, but only the grid — a pair's own detail
// page (and everything else under /profile/) still requires login, so
// browsing who's listed is open while actually reading a profile isn't.
function isPublicRoute(path: string): boolean {
  // Prefix match, not exact — every /archive/* page (trpg, links, a
  // session's own detail page, …) is genuinely public to view, reported
  // directly. Creating/editing a session still requires editor-or-admin,
  // enforced at the page level (trpg/new/page.tsx, [slug]/edit/page.tsx)
  // plus RLS underneath, not here — same split as /gallery/ below.
  if (path === '/' || path === '/archive' || path.startsWith('/archive/')) return true
  if (path === '/profile') return true
  // A pair's own detail page is now public too — reported directly. Its
  // content is truncated for anyone below editor/admin at the RLS level
  // (description_sections/timeline_entries stay editor/admin-only, see
  // migration 066), not here, so this only needs to stop /new and /edit
  // from letting a guest reach a write-only form, same split as /gallery/
  // below.
  if (path.startsWith('/profile/')) {
    return path !== '/profile/new' && !path.endsWith('/edit')
  }
  if (path === '/gallery') return true
  if (path.startsWith('/gallery/')) {
    return path !== '/gallery/new' && !path.endsWith('/edit')
  }
  return false
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const isAuthPage = AUTH_PAGES.some(r => path.startsWith(r))
  const isPublic    = isPublicRoute(path)

  // Logged-in users shouldn't see auth pages
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Guests can only access auth pages and public routes
  if (!user && !isAuthPage && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', path)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
