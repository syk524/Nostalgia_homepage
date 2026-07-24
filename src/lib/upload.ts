import { createClient } from '@/lib/supabase/client'

type Bucket = 'user-icons' | 'gallery-images'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

export async function uploadImage(file: File, ownerId: string, bucket: Bucket) {
  const supabase = createClient()

  if (!ALLOWED_TYPES.includes(file.type))
    return { url: null, error: 'Must be JPEG, PNG, GIF, or WebP.' }
  if (file.size > MAX_SIZE)
    return { url: null, error: 'File must be under 5 MB.' }

  const ext  = file.name.split('.').pop()
  const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(bucket).upload(path, file, { upsert: true })

  if (uploadErr) return { url: null, error: uploadErr.message }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function uploadImages(files: File[], ownerId: string, bucket: Bucket) {
  const results = await Promise.all(files.map(file => uploadImage(file, ownerId, bucket)))
  const urls = results.filter(r => r.url).map(r => r.url as string)
  const errors = results.filter(r => r.error).map(r => r.error as string)
  return { urls, errors }
}

type AudioBucket = 'playlist-audio'

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3']
const MAX_AUDIO_SIZE = 25 * 1024 * 1024

export async function uploadAudio(file: File, ownerId: string, bucket: AudioBucket) {
  const supabase = createClient()

  if (!ALLOWED_AUDIO_TYPES.includes(file.type))
    return { path: null, url: null, error: 'Must be an MP3 file.' }
  if (file.size > MAX_AUDIO_SIZE)
    return { path: null, url: null, error: 'File must be under 25 MB.' }

  const ext  = file.name.split('.').pop()
  const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(bucket).upload(path, file, { upsert: true })

  if (uploadErr) return { path: null, url: null, error: uploadErr.message }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { path, url: data.publicUrl, error: null }
}
