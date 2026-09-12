'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getPostDetail } from '@/lib/post-detail'
import type { PostType } from '@/types/database'

type PostImageInput = { url: string; focalX: number; focalY: number }
// One novel page — imageUrl is optional (a text-only page), matching
// post_pages.image_url's own nullability. imageCredit is likewise
// optional and only meaningful alongside an image (there's nothing to
// credit a caption to on a text-only page), but is still just carried
// straight through as a plain string here — the empty-vs-null
// normalization happens once, at the insert/update call sites below.
// isThumbnail/focalX/focalY are likewise only meaningful alongside an
// image — at most one page across the whole array should ever come in
// with isThumbnail true (the editor's own star toggle enforces that
// exclusivity client-side before submit; see novel-page-editor.tsx).
type PostPageInput = { imageUrl: string | null; imageCredit: string; isThumbnail: boolean; focalX: number; focalY: number; body: string }
type PostInput = {
  title: string; body: string; categoryId: string
  postType: PostType
  // Only the array matching postType is ever written — see
  // createPost/updatePost below, which always clear both tables first so
  // switching a post's type on edit can't leave orphaned rows in the one
  // it switched away from.
  images: PostImageInput[]
  pages: PostPageInput[]
}

// getPostDetail itself is a plain server-only function (called directly by
// both gallery/[id]/page.tsx and the intercepted @modal route) — this just
// exposes it as a callable action for post-modal.tsx's own prev/next, which
// fetches a new post's data client-side instead of navigating through
// Next's router, so the whole modal doesn't remount on every click (see
// that component's own comment for why the remount mattered).
export async function fetchPostDetail(id: string) {
  const detail = await getPostDetail(id)
  if (!detail) return { error: 'Post not found.' }
  return { success: true, ...detail }
}

export async function createPost(input: PostInput) {
  const { title, body, images, pages, categoryId, postType } = input
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!title.trim()) return { error: 'Title is required.' }
  if (!categoryId) return { error: 'Please choose a category.' }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({ author_id: user.id, title: title.trim(), body: body.trim(), category_id: categoryId, post_type: postType })
    .select('id')
    .single()

  if (error || !post) return { error: error?.message ?? 'Could not create the post.' }

  if (postType === 'novel') {
    if (pages.length) {
      const rows = pages.map((p, position) => ({
        post_id: post.id, position, image_url: p.imageUrl,
        image_credit: p.imageUrl ? p.imageCredit.trim() || null : null,
        is_thumbnail: p.imageUrl ? p.isThumbnail : false,
        focal_x: p.focalX, focal_y: p.focalY,
        body: p.body,
      }))
      const { error: pageErr } = await supabase.from('post_pages').insert(rows)
      if (pageErr) return { error: pageErr.message }
    }
  } else if (images.length) {
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
  const { title, body, images, pages, categoryId, postType } = input
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  if (!title.trim()) return { error: 'Title is required.' }
  if (!categoryId) return { error: 'Please choose a category.' }

  const { data: updated, error } = await supabase
    .from('posts')
    .update({ title: title.trim(), body: body.trim(), category_id: categoryId, post_type: postType, is_edited: true })
    .eq('id', postId)
    .select('id')

  if (error) return { error: error.message }
  // RLS silently filters rows it denies (no Postgres error) rather than
  // rejecting the request, so an empty result means "not allowed," not
  // "nothing to update."
  if (!updated?.length) return { error: 'You don’t have permission to edit this post.' }

  // Simplest v1: replace both the image and page sets wholesale on every
  // save, same convention as before — both tables get cleared regardless
  // of postType (not just the one matching it) so switching a post's
  // type here can never leave orphaned rows in the table it switched
  // away from.
  await supabase.from('post_images').delete().eq('post_id', postId)
  await supabase.from('post_pages').delete().eq('post_id', postId)
  if (postType === 'novel') {
    if (pages.length) {
      const rows = pages.map((p, position) => ({
        post_id: postId, position, image_url: p.imageUrl,
        image_credit: p.imageUrl ? p.imageCredit.trim() || null : null,
        is_thumbnail: p.imageUrl ? p.isThumbnail : false,
        focal_x: p.focalX, focal_y: p.focalY,
        body: p.body,
      }))
      const { error: pageErr } = await supabase.from('post_pages').insert(rows)
      if (pageErr) return { error: pageErr.message }
    }
  } else if (images.length) {
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
