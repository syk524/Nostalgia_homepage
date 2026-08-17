import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Plain API route, not a Server Action — see src/app/api/posts/[id]/route.ts
// for why (Server Action revalidation races a client window.location.href).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: deleted, error } = await supabase.from('character_pairs').delete().eq('id', id).select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!deleted?.length) return NextResponse.json({ error: 'You don’t have permission to delete this pair.' }, { status: 403 })

  revalidatePath('/profile')
  return NextResponse.json({ success: true })
}
