'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { reorderPosts } from '@/lib/actions/gallery'
import type { Post, Profile, PostImage, Category } from '@/types/database'

type GalleryPost = Post & { author: Profile; images: PostImage[]; category: Category }

const GRID_CLASSES = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'

function PostCard({ post, dragHandle }: { post: GalleryPost; dragHandle?: React.ReactNode }) {
  const thumb = [...(post.images ?? [])].sort((a, b) => a.position - b.position)[0]
  return (
    // Not a <Link> at the root — the drag handle is a sibling <button>,
    // and a <button> can't legally nest inside an <a> (invalid HTML,
    // same class of bug as the earlier nested-<form> issue).
    <div className="group relative rounded overflow-hidden shadow-parchment">
      <Link href={`/gallery/${post.id}`} className="block">
        {thumb
          ? <img
              src={thumb.image_url}
              alt=""
              className="w-full aspect-video object-cover block group-hover:scale-[1.02] transition-transform duration-300"
              style={{ objectPosition: `${thumb.focal_x}% ${thumb.focal_y}%` }}
            />
          : <div className="w-full aspect-video flex items-center justify-center bg-scroll-200">
              <img src="/placeholder-thumbnail.png" alt="" className="max-w-[60%] max-h-[60%] object-contain opacity-70" />
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
      {post.category && (
        <span className="absolute top-2 left-2 text-[10px] font-mono uppercase tracking-wide text-white bg-black/50 rounded px-1.5 py-0.5">
          {post.category.name}
        </span>
      )}
      {dragHandle}
    </div>
  )
}

function SortablePostCard({ post }: { post: GalleryPost }) {
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
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white/80 hover:text-white flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={13} />
          </button>
        }
      />
    </div>
  )
}

export function GalleryGrid({ posts: initialPosts, canReorder }: { posts: GalleryPost[]; canReorder: boolean }) {
  const [posts, setPosts] = useState(initialPosts)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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
      <div className={GRID_CLASSES}>
        {posts.map(post => <PostCard key={post.id} post={post} />)}
      </div>
    )
  }

  return (
    // Explicit id — without one, dnd-kit auto-generates its a11y description
    // id from a module-level counter, which can land on a different number
    // for the server render vs. the client's first render and trip a
    // hydration mismatch on `aria-describedby`.
    <DndContext id="gallery-grid" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={posts.map(p => p.id)} strategy={rectSortingStrategy}>
        <div className={GRID_CLASSES}>
          {posts.map(post => <SortablePostCard key={post.id} post={post} />)}
        </div>
      </SortableContext>
    </DndContext>
  )
}
