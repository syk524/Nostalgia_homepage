'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/slug'
import { deleteOrphanedImages } from '@/lib/storage-cleanup'

// Every <img src="..."> in a session body — a plain regex, not a DOM
// parse, since this runs server-side where there's no DOMParser (unlike
// deriveCoverUrl in trpg-session-editor.tsx, which does the same job
// client-side for the one cover-image case). Safe here specifically
// because `body` is never arbitrary/untrusted HTML by the time it
// reaches this action — it's always editor.getHTML()'s own well-formed,
// double-quoted-attribute serialization, not something a user typed
// freehand. Roll20 avatar srcs (external hosts) come back mixed in with
// our own trpg-images uploads; deleteOrphanedImages already filters down
// to our own storage objects before deleting anything, so there's no
// need to distinguish them here.
function extractImageUrls(html: string): string[] {
  const urls: string[] = []
  for (const match of html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)) urls.push(match[1])
  return urls
}

// Recomputed from the title on every save (not just once at creation) so
// the URL always tracks its current display name — excludeId keeps an
// unchanged title from colliding with its own existing row on update.
// Same shape as character_pairs' own uniqueSlug (characters.ts).
async function uniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, title: string, excludeId?: string): Promise<string> {
  const base = slugify(title)
  let candidate = base
  let suffix = 2
  for (;;) {
    let query = supabase.from('trpg_sessions').select('id').eq('slug', candidate)
    if (excludeId) query = query.neq('id', excludeId)
    const { data } = await query
    if (!data?.length) return candidate
    candidate = `${base}-${suffix++}`
  }
}

// One options object, not more positional string|null params — this was
// already at 5 (title, body, coverUrl, backgroundUrl, backgroundBlur)
// before dateRange/description, several sharing the exact same type, and
// a swapped pair of them at a call site wouldn't have shown up as a type
// error.
export type SessionInput = {
  title: string
  body: string
  dateRange: string | null
  description: string | null
  coverUrl: string | null
  backgroundUrl: string | null
  backgroundBlur: number
}

export async function createSession(input: SessionInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!input.title.trim()) return { error: 'Title is required.' }

  const slug = await uniqueSlug(supabase, input.title.trim())

  const { data: session, error } = await supabase
    .from('trpg_sessions')
    .insert({
      title: input.title.trim(),
      slug,
      body: input.body,
      date_range: input.dateRange,
      description: input.description,
      cover_url: input.coverUrl,
      background_url: input.backgroundUrl,
      background_blur: input.backgroundBlur,
      created_by: user.id,
    })
    .select('id, slug')
    .single()

  if (error || !session) return { error: error?.message ?? 'Could not create the session.' }

  revalidatePath('/archive/trpg')
  return { sessionId: session.id, slug: session.slug, error: null }
}

export async function updateSession(sessionId: string, input: SessionInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!input.title.trim()) return { error: 'Title is required.' }

  const slug = await uniqueSlug(supabase, input.title.trim(), sessionId)

  // Every image URL this session's OLD row referenced — cover_url and
  // background_url are plain columns, but the body's own images (scene
  // dividers, "Add image" inserts, avatar replacements) have no column
  // of their own at all, only whatever <img> tags happen to be in the
  // old HTML blob. Fetched before the update below overwrites body with
  // the new content — this is the only chance to see what the old one
  // used to reference.
  const { data: oldRow } = await supabase
    .from('trpg_sessions')
    .select('cover_url, background_url, body')
    .eq('id', sessionId)
    .single()

  const { data: updated, error } = await supabase
    .from('trpg_sessions')
    .update({
      title: input.title.trim(),
      slug,
      body: input.body,
      date_range: input.dateRange,
      description: input.description,
      cover_url: input.coverUrl,
      background_url: input.backgroundUrl,
      background_blur: input.backgroundBlur,
    })
    .eq('id', sessionId)
    .select('id, slug')

  if (error) return { error: error.message }
  // RLS silently filters rows it denies (no Postgres error) rather than
  // rejecting the request, so an empty result means "not allowed," not
  // "nothing to update" — same reasoning as updatePost (gallery.ts).
  if (!updated?.length) return { error: 'You don’t have permission to edit this session.' }

  if (oldRow) {
    await deleteOrphanedImages(
      supabase,
      [oldRow.cover_url, oldRow.background_url, ...extractImageUrls(oldRow.body)],
      [input.coverUrl, input.backgroundUrl, ...extractImageUrls(input.body)],
    )
  }

  revalidatePath('/archive/trpg')
  revalidatePath(`/archive/trpg/${updated[0].slug}`)
  return { sessionId, slug: updated[0].slug, error: null }
}

export async function deleteSession(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  // Fetched before the delete below removes the row (and this app's only
  // record of what it referenced) — every image this session used is
  // unambiguously orphaned once the session itself is gone, so nothing
  // needs to be diffed against a "new" set here, unlike updateSession.
  const { data: oldRow } = await supabase
    .from('trpg_sessions')
    .select('cover_url, background_url, body')
    .eq('id', sessionId)
    .single()

  const { data: deleted, error } = await supabase
    .from('trpg_sessions')
    .delete()
    .eq('id', sessionId)
    .select('id')

  if (error) return { error: error.message }
  if (!deleted?.length) return { error: 'You don’t have permission to remove this session.' }

  if (oldRow) {
    await deleteOrphanedImages(
      supabase,
      [oldRow.cover_url, oldRow.background_url, ...extractImageUrls(oldRow.body)],
      [],
    )
  }

  revalidatePath('/archive/trpg')
  return { error: null }
}
