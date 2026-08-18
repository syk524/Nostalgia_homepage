import { createClient } from '@/lib/supabase/server'
import type { StickerGalleryImage, UserBackgroundSticker } from '@/types/database'

export async function fetchStickerGallery(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<StickerGalleryImage[]> {
  const { data } = await supabase
    .from('sticker_gallery')
    .select('*')
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function fetchUserPlacements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<UserBackgroundSticker[]> {
  const { data } = await supabase
    .from('user_background_stickers')
    .select('*, gallery:sticker_gallery(*)')
    .eq('user_id', userId)
    .order('z', { ascending: true })

  return (data as unknown as UserBackgroundSticker[]) ?? []
}
