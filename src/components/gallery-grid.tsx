'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import placeholderThumbnail from '../../public/placeholder-thumbnail.png'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, BookOpen } from 'lucide-react'
import { reorderPosts } from '@/lib/actions/gallery'
import { DotMatrixLoader } from '@/components/dot-matrix-loader'
import type { Post, Profile, PostImage, PostPage, Category } from '@/types/database'

type GalleryPost = Post & { author: Profile; images: PostImage[]; pages?: PostPage[]; category: Category }

const GRID_CLASSES = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'

function PostCard({ post, dragHandle, onImageSettled }: { post: GalleryPost; dragHandle?: React.ReactNode; onImageSettled?: () => void }) {
  // A novel post never has post_images rows (see gallery.ts's own
  // createPost/updatePost) — its thumbnail is whichever page the editor
  // starred (novel-page-editor.tsx's own is_thumbnail toggle), so several
  // pages can carry an image without ambiguity over which one shows on
  // the grid. Falls back to "first page with an image" for posts saved
  // before that toggle existed, or that never touched it. focal_x/focal_y
  // are that same page's own crop framing, same meaning as PostImage's.
  const sortedPages = [...(post.pages ?? [])].sort((a, b) => a.position - b.position)
  const thumb = post.post_type === 'novel'
    ? sortedPages.find(p => p.is_thumbnail && p.image_url) ?? sortedPages.find(p => p.image_url)
    : [...(post.images ?? [])].sort((a, b) => a.position - b.position)[0]
  // thumbnail_url — a pre-shrunk 480px copy generated at upload time (see
  // lib/upload.ts) — wins when it exists; falls back to the full
  // image_url for anything uploaded before that existed. unoptimized is
  // set exactly when thumbnail_url is actually used, since that file is
  // already sized for this card and Vercel's own Image Optimization
  // re-resizing it per viewport width was what burned through the free
  // plan's transformation quota in the first place, with 70+ posts' worth
  // of cards each requesting several widths. The full-image fallback path
  // still goes through normal optimization, same as before.
  const thumbUrl = thumb?.thumbnail_url ?? thumb?.image_url ?? undefined
  const usingThumbnail = !!thumb?.thumbnail_url
  const focalX = thumb && 'focal_x' in thumb ? thumb.focal_x : 50
  const focalY = thumb && 'focal_y' in thumb ? thumb.focal_y : 50
  return (
    // Not a <Link> at the root — the drag handle is a sibling <button>,
    // and a <button> can't legally nest inside an <a> (invalid HTML,
    // same class of bug as the earlier nested-<form> issue).
    <div className="group relative rounded overflow-hidden">
      <Link href={`/gallery/${post.id}`} className="block">
        {thumbUrl
          ? <div className="relative w-full aspect-video overflow-hidden">
              <Image
                src={thumbUrl}
                alt=""
                fill
                unoptimized={usingThumbnail}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                style={{ objectPosition: `${focalX}% ${focalY}%` }}
                // onError too, not just onLoad — a broken/404'd image
                // still needs to count as "settled" for the grid's own
                // loading overlay (GalleryGrid), or one bad URL would
                // leave that overlay stuck forever instead of just
                // showing a blank box for that one card.
                onLoad={onImageSettled}
                onError={onImageSettled}
              />
            </div>
          : <div className="w-full aspect-video flex items-center justify-center bg-scroll-200">
              <Image
                src={placeholderThumbnail}
                alt=""
                className="max-w-[60%] max-h-[60%] object-contain opacity-70"
                onLoad={onImageSettled}
                onError={onImageSettled}
              />
            </div>
        }
        <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <h3 className="text-white font-medium truncate">{post.title}</h3>
          <p className="text-white/70 text-xs font-mono uppercase tracking-wide pt-1">
            {post.author?.display_name || post.author?.username}
            {post.is_edited ? ' · edited' : ''}
          </p>
        </div>
      </Link>
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        {post.category && (
          <span className="text-[10px] font-mono uppercase tracking-wide text-white bg-black/50 rounded px-1.5 py-0.5">
            {post.category.name}
          </span>
        )}
        {/* Only marker distinguishing a novel post from an image post on
            the grid — its thumbnail alone (falls back to the same
            placeholder-graphic treatment when a novel has no page images
            at all) doesn't otherwise signal "this opens a reader, not a
            photo," per direct request. Grouped with the category badge
            here (was its own top-2 right-2 corner, sharing that spot
            with the drag handle below in the editor reorder view) rather
            than needing its own separate positioning. */}
        {post.post_type === 'novel' && (
          <span className="w-5 h-5 rounded bg-black/50 text-white/80 flex items-center justify-center shrink-0" aria-label="Novel post">
            <BookOpen size={11} />
          </span>
        )}
      </div>
      {dragHandle}
    </div>
  )
}

// Same quiet-at-rest, tint-on-hover tile as character-pair-grid.tsx's
// AddPairCard — plain <a>, not next/link: /gallery/new is a static
// sibling of the dynamic [id] route, but the modal's interception
// rewrite (see gallery/page.tsx's own comment on its old New Post
// button) matches any single segment under /gallery/ on soft
// navigation, so a client-side Link here would land in the post-detail
// modal with id="new" instead of the real page. aspect-video, not a
// fixed height — matches PostCard's own image box exactly, and unlike
// character-pair-grid's tile there's no separate caption row below it
// to account for (PostCard's caption is an absolute overlay inside the
// same box), so no self-end/row-height juggling is needed here.
function AddPostTile({ href }: { href: string }) {
  return (
    <a href={href} className="group block rounded overflow-hidden">
      <div className="w-full aspect-video flex items-center justify-center text-scroll-400 transition-colors group-hover:text-ink-600 group-hover:bg-[#2F2F2E]/20 noir-group-hover noir-icon-accent">
        <Plus size={28} />
      </div>
    </a>
  )
}

function SortablePostCard({ post, onImageSettled }: { post: GalleryPost; onImageSettled?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <PostCard
        post={post}
        onImageSettled={onImageSettled}
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="absolute top-2 right-2 w-6 h-6 rounded bg-black/50 text-white/80 hover:text-white flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={13} />
          </button>
        }
      />
    </div>
  )
}

export function GalleryGrid({ posts: initialPosts, canReorder, canEdit, newPostHref }: { posts: GalleryPost[]; canReorder: boolean; canEdit: boolean; newPostHref: string }) {
  const [posts, setPosts] = useState(initialPosts)
  // A Set of post ids, not a raw counter — onLoad/onError could in
  // principle fire more than once for the same card (or in either order),
  // and a plain increment would double-count that instead of no-op'ing
  // like this does. "Settled" (loaded OR errored), not "loaded" — a
  // single broken image URL shouldn't leave this stuck showing the
  // overlay forever, per PostCard's own onError comment.
  const [settledIds, setSettledIds] = useState<Set<string>>(new Set())
  const allImagesSettled = settledIds.size >= posts.length
  function markSettled(postId: string) {
    setSettledIds(prev => (prev.has(postId) ? prev : new Set(prev).add(postId)))
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Sits over the grid (not the whole page — Nav and the category rail
  // stay visible and usable) until every card's own thumbnail has
  // settled, per direct request. No background fill — just the dots
  // floating over whatever's already rendered underneath (the cards'
  // own placeholder-colored boxes render immediately regardless of
  // their image's own load state, so there's no bare/unstyled flash
  // for this to cover in the first place).
  const loadingOverlay = !allImagesSettled && (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <DotMatrixLoader size={32} busyCursor={false} />
    </div>
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, collisions } = event
    // `event.over` isn't reliable here — cards vary wildly in height (this
    // is a masonry grid, not a uniform list/grid), and closestCenter's own
    // `over` pick doesn't consistently exclude the active item when its own
    // (translated) rect is still in the candidate set. The `collisions`
    // array itself has the correct ranked distances, so resolve the target
    // from that directly instead of trusting `over`.
    const target = [...(collisions ?? [])]
      .filter(c => c.id !== active.id)
      .sort((a, b) => (a.data?.value ?? Infinity) - (b.data?.value ?? Infinity))[0]
    if (!target) return

    const oldIndex = posts.findIndex(p => p.id === active.id)
    const newIndex = posts.findIndex(p => p.id === target.id)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const reordered = arrayMove(posts, oldIndex, newIndex)
    setPosts(reordered)
    await reorderPosts(reordered.map(p => p.id))
  }

  if (!canReorder) {
    return (
      <div className="relative">
        {loadingOverlay}
        <div className={GRID_CLASSES}>
          {canEdit && <AddPostTile href={newPostHref} />}
          {posts.map(post => <PostCard key={post.id} post={post} onImageSettled={() => markSettled(post.id)} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {loadingOverlay}
      {/* Explicit id — without one, dnd-kit auto-generates its a11y
          description id from a module-level counter, which can land on a
          different number for the server render vs. the client's first
          render and trip a hydration mismatch on `aria-describedby`. */}
      <DndContext id="gallery-grid" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={posts.map(p => p.id)} strategy={rectSortingStrategy}>
          <div className={GRID_CLASSES}>
            {canEdit && <AddPostTile href={newPostHref} />}
            {posts.map(post => <SortablePostCard key={post.id} post={post} onImageSettled={() => markSettled(post.id)} />)}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
