'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createPost(title: string, body: string, imageUrls: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!title.trim()) return { error: 'Title is required.' }
  if (!body.trim()) return { error: 'Text is required.' }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({ author_id: user.id, title: title.trim(), body: body.trim() })
    .select('id')
    .single()

  if (error || !post) return { error: error?.message ?? 'Could not create the post.' }

  if (imageUrls.length) {
    const rows = imageUrls.map((image_url, position) => ({ post_id: post.id, image_url, position }))
    const { error: imgErr } = await supabase.from('post_images').insert(rows)
    if (imgErr) return { error: imgErr.message }
  }

  revalidatePath('/gallery')
  redirect(`/gallery/${post.id}`)
}

export async function updatePost(postId: string, title: string, body: string, imageUrls: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!title.trim()) return { error: 'Title is required.' }
  if (!body.trim()) return { error: 'Text is required.' }

  const { data: updated, error } = await supabase
    .from('posts')
    .update({ title: title.trim(), body: body.trim(), is_edited: true })
    .eq('id', postId)
    .select('id')

  if (error) return { error: error.message }
  // RLS silently filters rows it denies (no Postgres error) rather than
  // rejecting the request, so an empty result means "not allowed," not
  // "nothing to update."
  if (!updated?.length) return { error: 'You don’t have permission to edit this post.' }

  // Simplest v1: replace the image set wholesale on every save.
  await supabase.from('post_images').delete().eq('post_id', postId)
  if (imageUrls.length) {
    const rows = imageUrls.map((image_url, position) => ({ post_id: postId, image_url, position }))
    const { error: imgErr } = await supabase.from('post_images').insert(rows)
    if (imgErr) return { error: imgErr.message }
  }

  revalidatePath('/gallery')
  revalidatePath(`/gallery/${postId}`)
  redirect(`/gallery/${postId}`)
}

export async function deletePost(postId: string) {
  const supabase = await createClient()
  const { data: deleted, error } = await supabase.from('posts').delete().eq('id', postId).select('id')

  if (error) return { error: error.message }
  if (!deleted?.length) return { error: 'You don’t have permission to delete this post.' }

  revalidatePath('/gallery')
  redirect('/gallery')
}
