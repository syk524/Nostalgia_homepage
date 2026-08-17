import { notFound, redirect } from 'next/navigation'
import { getPostDetail } from '@/lib/post-detail'
import { PostModal } from '@/components/post-modal'

export default async function InterceptedPostModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // The interception rewrite matches ANY single segment under /gallery/ —
  // it can't tell "new" (a real static sibling route) apart from a post id,
  // so a soft-nav click on "New Post" was landing here with id="new",
  // finding no such post, and 404ing. Send it to the real page instead.
  if (id === 'new') redirect('/gallery/new')

  const detail = await getPostDetail(id)
  if (!detail) notFound()

  return (
    <PostModal
      post={detail.post}
      canEdit={detail.canEdit}
      prevId={detail.prevId}
      nextId={detail.nextId}
    />
  )
}
