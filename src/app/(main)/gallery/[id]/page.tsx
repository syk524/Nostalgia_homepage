import { notFound } from 'next/navigation'
import { getPostDetail } from '@/lib/post-detail'
import { PostModal } from '@/components/post-modal'

// Hit directly on a hard navigation/refresh (interception only kicks in for
// soft nav from within the app) — renders the same PostModal as the
// intercepted route so there's no separate "full page" design to fall back
// to or drift out of sync.
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
