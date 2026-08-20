'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function parseYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  // bare 11-char id pasted directly
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim()
  return null
}

// Catches the "video owner disabled embedding" case at add-time
// instead of only discovering it later when someone hits play (see
// sound-player.tsx's playError/onError handling for that fallback,
// which still applies for anything this check can't catch — e.g. a
// video that becomes unembeddable after being added). Fails open (lets
// the add through) on anything that isn't a clear signal from the API
// itself — no key configured, a network hiccup, a non-200 response —
// since this is a UX improvement, not something correctness depends
// on, and the playError fallback still catches a genuinely broken
// video either way.
async function checkYoutubeEmbeddable(videoId: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${videoId}&key=${apiKey}`)
    if (!res.ok) return null

    const data = await res.json()
    const item = data.items?.[0]
    if (!item) return 'Video not found, private, or removed.'
    if (item.status?.embeddable === false) {
      return 'This video can’t be embedded — its owner has disabled playback outside YouTube. Try a different link.'
    }
    return null
  } catch {
    return null
  }
}

async function requireEditor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: 'You must be signed in.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'editor' && profile?.role !== 'admin') {
    return { supabase, user: null, error: 'You don’t have edit authority for the playlist.' }
  }
  return { supabase, user, error: null }
}

export async function addYoutubeTrack(url: string, title: string, artist: string) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { track: null, error: authError }

  const videoId = parseYoutubeId(url)
  if (!videoId) return { track: null, error: 'Could not find a YouTube video ID in that link.' }

  const embedError = await checkYoutubeEmbeddable(videoId)
  if (embedError) return { track: null, error: embedError }

  const { count } = await supabase.from('playlist_tracks').select('id', { count: 'exact', head: true })

  const { data: track, error } = await supabase
    .from('playlist_tracks')
    .insert({
      added_by: user.id,
      source: 'youtube',
      title: title.trim() || 'Untitled',
      artist: artist.trim() || 'Unknown Artist',
      source_ref: videoId,
      duration_seconds: null,
      position: count ?? 0,
    })
    .select('*')
    .single()

  if (error || !track) return { track: null, error: error?.message ?? 'Could not add the track.' }
  revalidatePath('/')
  return { track, error: null }
}

export async function addUploadedTrack(storagePath: string, title: string, artist: string) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { track: null, error: authError }

  const { count } = await supabase.from('playlist_tracks').select('id', { count: 'exact', head: true })

  const { data: track, error } = await supabase
    .from('playlist_tracks')
    .insert({
      added_by: user.id,
      source: 'upload',
      title: title.trim() || 'Untitled',
      artist: artist.trim() || 'Unknown Artist',
      source_ref: storagePath,
      duration_seconds: null,
      position: count ?? 0,
    })
    .select('*')
    .single()

  if (error || !track) return { track: null, error: error?.message ?? 'Could not add the track.' }
  revalidatePath('/')
  return { track, error: null }
}

// Mirrors reorderPosts (lib/actions/gallery.ts) — bulk-persist a new
// position for every track, in the order the client already committed
// to locally (see QueueList's dnd-kit drag end). requireEditor gates
// this the same as add/remove; the currently-playing track's own
// position isn't special-cased here — sound-player.tsx's handleReorder
// keeps currentIndex pointed at the right track by id regardless of
// where the reorder lands it, which is the actual thing that mattered.
export async function reorderTracks(orderedIds: string[]) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { error: authError }

  const results = await Promise.all(
    orderedIds.map((id, position) => supabase.from('playlist_tracks').update({ position }).eq('id', id))
  )
  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }

  revalidatePath('/')
  return { error: null }
}

export async function removeTrack(trackId: string) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { error: authError }

  const { data: deleted, error } = await supabase
    .from('playlist_tracks')
    .delete()
    .eq('id', trackId)
    .select('id')

  if (error) return { error: error.message }
  // RLS silently filters rows it denies (no Postgres error) rather than
  // rejecting the request, so an empty result means "not allowed," not
  // "nothing to delete."
  if (!deleted?.length) return { error: 'You don’t have permission to remove this track.' }
  revalidatePath('/')
  return { error: null }
}
