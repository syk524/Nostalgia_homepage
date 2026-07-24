import { createClient } from '@/lib/supabase/client'
import type { PlaylistTrack } from '@/types/database'

export type QueueTrack = PlaylistTrack & { queuePosition: number }

export async function fetchQueue(): Promise<QueueTrack[]> {
  const supabase = createClient()

  const { data: tracks } = await supabase
    .from('playlist_tracks')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (!tracks) return []
  return tracks.map((t, i) => ({ ...t, queuePosition: i }))
}
