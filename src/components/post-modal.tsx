'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { DeletePostButton } from '@/app/(main)/gallery/[id]/delete-button'
import { getLastListView } from '@/lib/list-view-tracker'
import type { Post, Profile, PostImage, Category } from '@/types/database'

type FullPost = Post & { author: Profile; images: PostImage[]; category: Category }

export function PostModal({
  post, canEdit, prevId, nextId,
}: {
  post: FullPost
  canEdit: boolean
  prevId?: string | null
  nextId?: string | null
}) {
  const router = useRouter()
  const images = [...(post.images ?? [])].sort((a, b) => a.position - b.position)
  const backdrop = images[0]?.image_url

  // Always jump straight to the actual gallery list the user last saw —
  // router.back() depends on exactly how this popover was reached (edit →
  // cancel, edit → save, browsing prev/next), and those don't all put the
  // list one step behind in history, so back() could land on a stale form
  // page or a different post instead.
  //
  // A hard navigation, not router.push(): pushing to a URL that matches the
  // @children slot's existing path doesn't reconcile the @modal parallel
  // slot in Next.js's App Router — the URL bar updates but the modal stays
  // rendered on top, since only popping history (router.back()) reliably
  // clears it. window.location.href forces a full reload instead, sidestepping
  // that soft-navigation quirk entirely (same fix already used for deletion
  // in gallery/[id]/delete-button.tsx).
  function close() {
    window.location.href = getLastListView()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft' && prevId) router.replace(`/gallery/${prevId}`)
      if (e.key === 'ArrowRight' && nextId) router.replace(`/gallery/${nextId}`)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [router, prevId, nextId])

  return (
    // calc(2.6vw+159px) clears Nav's floating category links (left-2.6%,
    // ~99px wide at their widest label) with a steady 60px gap — see
    // gallery/page.tsx for why vw, not %. Nav is mounted once at the
    // root layout, sits above this modal's z-50 via its own z-[60], and
    // never remounts between posts, so it's the same nav everywhere rather
    // than something owned by this modal. No bg here — that gutter stays
    // transparent so the app's own background (decorative grid +
    // bg-scroll-100, from the root layout) shows through behind the nav
    // instead of being painted over; each content panel below carries its
    // own opaque background instead.
    <div className="fixed inset-0 z-50 sm:pl-[calc(2.6vw+159px)] flex flex-col sm:flex-row animate-fade-up">
      {/* Metadata sidebar — fixed width on desktop, unless there are no
          images to show, in which case it takes the full remaining width
          instead of leaving an empty placeholder pane next to it. */}
      <div className={`${images.length ? 'w-full sm:w-96 shrink-0' : 'flex-1'} max-h-[45vh] sm:max-h-full sm:h-full overflow-y-auto border-b sm:border-b-0 sm:border-r border-scroll-300 bg-scroll-50 p-6 flex flex-col gap-4`}>
        <div className="flex items-center gap-1 -ml-2">
          <button
            onClick={close}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-scroll-200 text-ink flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
          <Link
            href={prevId ? `/gallery/${prevId}` : '#'}
            replace={!!prevId}
            aria-label="Previous post"
            aria-disabled={!prevId}
            onClick={e => { if (!prevId) e.preventDefault() }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${prevId ? 'hover:bg-scroll-200 text-ink' : 'text-scroll-300 cursor-default'}`}
          >
            <ChevronLeft size={16} />
          </Link>
          <Link
            href={nextId ? `/gallery/${nextId}` : '#'}
            replace={!!nextId}
            aria-label="Next post"
            aria-disabled={!nextId}
            onClick={e => { if (!nextId) e.preventDefault() }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${nextId ? 'hover:bg-scroll-200 text-ink' : 'text-scroll-300 cursor-default'}`}
          >
            <ChevronRight size={16} />
          </Link>
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-ink-400 text-xs font-mono uppercase tracking-wide">Gallery</p>
          <h1 className="text-2xl text-ink leading-tight">{post.title}</h1>
        </div>

        <p className="text-ink-400 text-xs font-mono">{formatDate(post.created_at)}{post.is_edited ? ' · edited' : ''}</p>

        <div className="space-y-3 text-sm pt-4 mt-2 border-t border-scroll-300">
          <div className="flex justify-between items-baseline gap-4">
            <span className="text-ink-400 font-mono text-xs uppercase tracking-wide">Author</span>
            <span className="text-ink text-right">{post.author?.display_name || post.author?.username}</span>
          </div>
          {post.category && (
            <div className="flex justify-between items-baseline gap-4">
              <span className="text-ink-400 font-mono text-xs uppercase tracking-wide">Category</span>
              <span className="tag">{post.category.name}</span>
            </div>
          )}
        </div>

        {post.body && (
          <p className="text-ink whitespace-pre-wrap leading-relaxed text-sm pt-4 mt-2 border-t border-scroll-300">{post.body}</p>
        )}

        {canEdit && (
          <div className="flex gap-2 pt-4 mt-auto border-t border-scroll-300">
            <a href={`/gallery/${post.id}/edit`} className="btn-ghost">Edit</a>
            <DeletePostButton postId={post.id} />
          </div>
        )}
      </div>

      {/* Image area — blurred, scaled backdrop fills the dead space; the
          actual image(s) sit framed on top, scrolling as a stack for
          multi-image posts. Skipped entirely when there's nothing to show,
          so the metadata sidebar above takes the full width instead. */}
      {images.length > 0 && (
        <div className="relative flex-1 min-h-0 overflow-hidden bg-scroll-200">
          {backdrop && (
            <img
              src={backdrop}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-3xl scale-110 opacity-70"
            />
          )}
          {/* Each image is capped well under full height when there's more
              than one, so the next image's top edge peeks in at the bottom
              of the viewport as a scroll affordance instead of being fully
              hidden below the fold. The first image gets its own min-h-full
              wrapper so it sits vertically centered in the pane on load —
              later images (if any) just stack normally beneath it, not
              individually centered. */}
          <div className="relative h-full overflow-y-auto flex flex-col items-center gap-2 p-6 sm:p-12">
            {images.map((img, i) => (
              i === 0 ? (
                <div key={img.id} className="min-h-full w-full flex items-center justify-center shrink-0">
                  <img
                    src={img.image_url}
                    alt=""
                    className={`max-w-full w-auto rounded-lg shadow-2xl ${images.length > 1 ? 'max-h-[65vh]' : 'max-h-[80vh]'}`}
                  />
                </div>
              ) : (
                <img
                  key={img.id}
                  src={img.image_url}
                  alt=""
                  className="max-w-full w-auto rounded-lg shadow-2xl shrink-0 max-h-[65vh]"
                />
              )
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
