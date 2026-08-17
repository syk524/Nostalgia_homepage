import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// A plain API route, not a Server Action, specifically for delete — Next's
// Server Action client runtime automatically re-navigates the current
// route after revalidatePath resolves, and that raced against (and beat)
// a client-side window.location.href fired right after the action's
// promise settled, leaving the browser stuck on the just-deleted post's
// now-404 URL. A regular fetch() has no such router integration.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: deleted, error } = await supabase.from('posts').delete().eq('id', id).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!deleted?.length) return NextResponse.json({ error: 'You don’t have permission to delete this post.' }, { status: 403 })

  revalidatePath('/gallery')
  return NextResponse.json({ success: true })
}
