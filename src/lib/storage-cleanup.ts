import { createClient } from '@/lib/supabase/server'

// Supabase's own public-URL shape (getPublicUrl in upload.ts) is always
// `.../storage/v1/object/public/<bucket>/<path>` — parsing that marker out
// of a stored URL string, rather than adding a dedicated `*_path` column
// next to every image URL column (the pattern day-counter.ts already uses
// for its one photo field), covers every image-bearing column across both
// pair_profiles/profile_characters and trpg_sessions without a migration
// per field. Returns null for anything that isn't actually one of our own
// storage objects — a Roll20 avatar URL (files.d20.io) or any other
// external link doesn't match this shape at all, and must never be passed
// to storage.remove() regardless of what a diff thinks is "orphaned."
const PUBLIC_URL_MARKER = '/storage/v1/object/public/'

function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const idx = url.indexOf(PUBLIC_URL_MARKER)
  if (idx === -1) return null
  const rest = url.slice(idx + PUBLIC_URL_MARKER.length)
  const slashIdx = rest.indexOf('/')
  if (slashIdx === -1) return null
  const bucket = rest.slice(0, slashIdx)
  const path = rest.slice(slashIdx + 1)
  if (!bucket || !path) return null
  try {
    return { bucket, path: decodeURIComponent(path) }
  } catch {
    return null
  }
}

// Deletes every URL present in `oldUrls` but absent from `newUrls` — the
// two "delete the image" cases reported directly: an override (the old
// URL isn't in the new set because a fresh upload replaced it) and no
// longer being used at all (the old URL isn't in the new set because the
// field was cleared, or an image was removed from a session's body).
// Safe to call with a mix of null/undefined/external/our-own URLs in
// either list — nulls are dropped, and parseStorageUrl already filters
// out anything that isn't genuinely one of our own storage objects before
// any .remove() call is attempted. Deliberately swallows storage errors
// (logged, not thrown/returned) — a failed cleanup shouldn't turn into a
// failed save; the content is already safely written by the time this
// runs in every call site.
export async function deleteOrphanedImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  oldUrls: (string | null | undefined)[],
  newUrls: (string | null | undefined)[],
): Promise<void> {
  const newSet = new Set(newUrls.filter((u): u is string => !!u))
  const orphaned = Array.from(new Set(oldUrls.filter((u): u is string => !!u && !newSet.has(u))))
  if (!orphaned.length) return

  const pathsByBucket = new Map<string, string[]>()
  for (const url of orphaned) {
    const parsed = parseStorageUrl(url)
    if (!parsed) continue
    const paths = pathsByBucket.get(parsed.bucket) ?? []
    paths.push(parsed.path)
    pathsByBucket.set(parsed.bucket, paths)
  }

  for (const [bucket, paths] of pathsByBucket) {
    const { error } = await supabase.storage.from(bucket).remove(paths)
    if (error) console.error(`Failed to remove orphaned images from ${bucket}:`, error.message)
  }
}
