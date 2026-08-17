'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type PostImageInput = { url: string; focalX: number; focalY: number }
type PostInput = { title: string; body: string; images: PostImageInput[]; categoryId: string }

export async function createPost(input: PostInput) {
  const { title, body, images, categoryId } = input
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!title.trim()) return { error: 'Title is required.' }
  if (!categoryId) return { error: 'Please choose a category.' }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({ author_id: user.id, title: title.trim(), body: body.trim(), category_id: categoryId })
    .select('id')
    .single()

  if (error || !post) return { error: error?.message ?? 'Could not create the post.' }

  if (images.length) {
    const rows = images.map((img, position) => ({
      post_id: post.id, image_url: img.url, position, focal_x: img.focalX, focal_y: img.focalY,
    }))
    const { error: imgErr } = await supabase.from('post_images').insert(rows)
    if (imgErr) return { error: imgErr.message }
  }

  revalidatePath('/gallery')
  // No redirect() here — Server Action redirects always navigate to the
  // canonical route, never through the intercepting-route mechanism, so a
  // post created this way would always land on the plain full page instead
  // of the popover. The caller does a client-side router.push instead,
  // which does participate in interception (see new-post-form.tsx).
  return { success: true, postId: post.id }
}

export async function updatePost(postId: string, input: PostInput) {
  const { title, body, images, categoryId } = input
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!title.trim()) return { error: 'Title is required.' }
  if (!categoryId) return { error: 'Please choose a category.' }

  const { data: updated, error } = await supabase
    .from('posts')
    .update({ title: title.trim(), body: body.trim(), category_id: categoryId, is_edited: true })
    .eq('id', postId)
    .select('id')

  if (error) return { error: error.message }
  // RLS silently filters rows it denies (no Postgres error) rather than
  // rejecting the request, so an empty result means "not allowed," not
  // "nothing to update."
  if (!updated?.length) return { error: 'You don’t have permission to edit this post.' }

  // Simplest v1: replace the image set wholesale on every save.
  await supabase.from('post_images').delete().eq('post_id', postId)
  if (images.length) {
    const rows = images.map((img, position) => ({
      post_id: postId, image_url: img.url, position, focal_x: img.focalX, focal_y: img.focalY,
    }))
    const { error: imgErr } = await supabase.from('post_images').insert(rows)
    if (imgErr) return { error: imgErr.message }
  }

  revalidatePath('/gallery')
  revalidatePath(`/gallery/${postId}`)
  // See createPost — same reason there's no redirect() here.
  return { success: true, postId }
}

// Persists a drag-reordered gallery: orderedIds[0] becomes position 0, etc.
// Only ever called from the unfiltered "All" view, so this always covers
// every post — no interleaving with a filtered subset to reason about.
export async function reorderPosts(orderedIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const results = await Promise.all(
    orderedIds.map((id, position) => supabase.from('posts').update({ position }).eq('id', id))
  )
  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }

  revalidatePath('/gallery')
  return { success: true }
}
