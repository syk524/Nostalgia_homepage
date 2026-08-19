import { createClient } from '@/lib/supabase/client'

type Bucket = 'user-icons' | 'gallery-images' | 'sticker-images' | 'day-counter-photos'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

const MAX_DIMENSION = 2560
const WEBP_QUALITY = 0.85

function withExtension(name: string, ext: string) {
  return name.replace(/\.[^./]+$/, '') + '.' + ext
}

// Downscales oversized images and re-encodes them as WebP client-side
// before they ever hit the network — a typical phone-camera JPEG (4000px+,
// several MB) comes out well under a megabyte with no visible quality loss
// for gallery display. Animated GIFs are left untouched: a canvas only
// captures one frame, which would flatten the animation.
async function optimizeForUpload(file: File): Promise<File> {
  if (file.type === 'image/gif') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const webp = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
    if (webp && webp.type === 'image/webp') {
      return new File([webp], withExtension(file.name, 'webp'), { type: 'image/webp' })
    }

    // Browser can't encode WebP (older Safari) — the resize alone is still
    // worth keeping, shipped as a compressed JPEG instead of the original.
    const jpeg = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', WEBP_QUALITY))
    if (jpeg) return new File([jpeg], withExtension(file.name, 'jpg'), { type: 'image/jpeg' })

    return file
  } catch {
    // Corrupt/unreadable-by-canvas file — upload the original rather than
    // failing the whole post over an optimization step.
    return file
  }
}

export async function uploadImage(file: File, ownerId: string, bucket: Bucket) {
  const supabase = createClient()

  if (!ALLOWED_TYPES.includes(file.type))
    return { url: null, path: null, error: 'Must be JPEG, PNG, GIF, or WebP.' }

  const uploadFile = bucket === 'gallery-images' || bucket === 'sticker-images' || bucket === 'day-counter-photos' ? await optimizeForUpload(file) : file

  if (uploadFile.size > MAX_SIZE)
    return { url: null, path: null, error: 'File must be under 5 MB.' }

  const ext  = uploadFile.name.split('.').pop()
  const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(bucket).upload(path, uploadFile, { upsert: true })

  if (uploadErr) return { url: null, path: null, error: uploadErr.message }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, path, error: null }
}

export async function uploadImages(files: File[], ownerId: string, bucket: Bucket) {
  const results = await Promise.all(files.map(file => uploadImage(file, ownerId, bucket)))
  const urls = results.filter(r => r.url).map(r => r.url as string)
  const errors = results.filter(r => r.error).map(r => r.error as string)
  return { urls, errors }
}

type HtmlBucket = 'profile-pages'

const MAX_HTML_SIZE = 2 * 1024 * 1024

// Extension check rather than file.type — unlike images/audio, browsers
// don't reliably set a MIME type for a local .html file across OSes.
// contentType is set explicitly on upload so the bucket serves the right
// header regardless of what (if anything) the browser guessed.
export async function uploadHtmlPage(file: File, ownerId: string, bucket: HtmlBucket) {
  const supabase = createClient()

  if (!file.name.toLowerCase().endsWith('.html'))
    return { url: null, error: 'Must be an HTML file.' }
  if (file.size > MAX_HTML_SIZE)
    return { url: null, error: 'File must be under 2 MB.' }

  const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`

  const { error: uploadErr } = await supabase.storage
    .from(bucket).upload(path, file, { upsert: true, contentType: 'text/html' })

  if (uploadErr) return { url: null, error: uploadErr.message }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
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
