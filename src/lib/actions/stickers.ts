'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireEditor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: 'You must be signed in.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'editor' && profile?.role !== 'admin') {
    return { supabase, user: null, error: 'You don’t have edit authority for the sticker gallery.' }
  }
  return { supabase, user, error: null }
}

export async function addGalleryImage(imageUrl: string, storagePath: string) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { image: null, error: authError }

  const { data: image, error } = await supabase
    .from('sticker_gallery')
    .insert({ image_url: imageUrl, storage_path: storagePath, created_by: user.id })
    .select('*')
    .single()

  if (error || !image) return { image: null, error: error?.message ?? 'Could not add the image.' }
  revalidatePath('/')
  return { image, error: null }
}

export async function deleteGalleryImage(id: string, storagePath: string) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { error: authError }

  const { data: deleted, error } = await supabase
    .from('sticker_gallery')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!deleted?.length) return { error: 'You don’t have permission to remove this image.' }

  await supabase.storage.from('sticker-images').remove([storagePath])
  revalidatePath('/')
  return { error: null }
}

export async function savePlacement(placement: {
  id?: string
  galleryId: string
  x: number
  y: number
  scale: number
  rotation: number
  z: number
}) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { placement: null, error: authError }

  const mutable = {
    pos_x: placement.x,
    pos_y: placement.y,
    scale: placement.scale,
    rotation: placement.rotation,
    z: placement.z,
  }

  const { data: saved, error } = placement.id
    ? await supabase.from('user_background_stickers').update(mutable).eq('id', placement.id).select('*').single()
    : await supabase.from('user_background_stickers').insert({ ...mutable, user_id: user.id, gallery_id: placement.galleryId }).select('*').single()

  if (error || !saved) return { placement: null, error: error?.message ?? 'Could not save the sticker.' }
  revalidatePath('/')
  return { placement: saved, error: null }
}

export async function removePlacement(id: string) {
  const { supabase, user, error: authError } = await requireEditor()
  if (!user) return { error: authError }

  const { data: deleted, error } = await supabase
    .from('user_background_stickers')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!deleted?.length) return { error: 'You don’t have permission to remove this sticker.' }
  revalidatePath('/')
  return { error: null }
}
