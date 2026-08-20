'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadImages } from '@/lib/upload'
import { createPost } from '@/lib/actions/gallery'
import { CategoryPicker } from '@/components/category-picker'
import { ImageManager } from '@/components/image-manager'
import type { Category } from '@/types/database'

type ImageItem = { file: File; preview: string; focalX: number; focalY: number }

export function NewPostForm({ categories: initialCategories, initialCategoryId = null }: { categories: Category[]; initialCategoryId?: string | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const navigateRef = useRef<HTMLAnchorElement>(null)

  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')
  const [categories, setCategories] = useState(initialCategories)
  // Pre-filled when reached from a filtered gallery view (e.g. the "+"
  // tile on the Commission page) — still just the CategoryPicker's
  // ordinary starting selection, not locked in any way, so the user can
  // freely pick a different category before publishing.
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId)
  const [images, setImages] = useState<ImageItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdPostId, setCreatedPostId] = useState<string | null>(null)

  // router.push() doesn't participate in intercepting-route matching the
  // way an actual <Link> click does (verified: it always hits the
  // canonical route, never the modal) — so once the post exists, click a
  // real, momentarily-rendered Link instead of calling the router directly.
  useEffect(() => {
    if (createdPostId) navigateRef.current?.click()
  }, [createdPostId])

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? [])
    if (!chosen.length) return
    setImages(prev => [...prev, ...chosen.map(file => ({ file, preview: URL.createObjectURL(file), focalX: 50, focalY: 50 }))])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  function setThumbnail(index: number) {
    setImages(prev => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.unshift(item)
      return next
    })
  }

  function setFocal(index: number, x: number, y: number) {
    setImages(prev => prev.map((img, i) => i === index ? { ...img, focalX: x, focalY: y } : img))
  }

  function reorderImages(from: number, to: number) {
    setImages(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // No category picked — default to "Etc" instead of blocking publish.
    const effectiveCategoryId = categoryId ?? categories.find(c => c.name === 'Etc')?.id ?? null
    if (!effectiveCategoryId) { setError('Please choose a category.'); setSubmitting(false); return }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('You must be signed in.'); setSubmitting(false); return }

    let imagePayload: { url: string; focalX: number; focalY: number }[] = []
    if (images.length) {
      const { urls, errors } = await uploadImages(images.map(i => i.file), user.id, 'gallery-images')
      if (errors.length) { setError(errors[0]); setSubmitting(false); return }
      imagePayload = urls.map((url, i) => ({ url, focalX: images[i].focalX, focalY: images[i].focalY }))
    }

    const result = await createPost({ title, body, images: imagePayload, categoryId: effectiveCategoryId })
    if (result?.error || !result?.postId) { setError(result?.error ?? 'Could not create the post.'); setSubmitting(false); return }
    setCreatedPostId(result.postId)
  }

  return (
    <div className="max-w-2xl space-y-6 mx-auto">
      {createdPostId && (
        <Link href={`/gallery/${createdPostId}`} ref={navigateRef} className="hidden" aria-hidden="true">
          go
        </Link>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5 animate-slide-up">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className="input" value={title}
            onChange={e => setTitle(e.target.value)} placeholder="Post title" required />
        </div>

        <div>
          <label className="label">Category</label>
          <CategoryPicker
            categories={categories}
            selectedId={categoryId}
            onChange={setCategoryId}
            onCategoryCreated={cat => setCategories(prev => [...prev, cat])}
          />
        </div>

        <div>
          <label className="label" htmlFor="body">Text (optional)</label>
          <textarea id="body" className="textarea" rows={8} value={body}
            onChange={e => setBody(e.target.value)} placeholder="Write something…" />
        </div>

        <div>
          <label className="label">Images</label>
          <ImageManager
            images={images.map(i => ({ src: i.preview, focalX: i.focalX, focalY: i.focalY }))}
            onSetThumbnail={setThumbnail}
            onRemove={removeImage}
            onFocalChange={setFocal}
            onReorder={reorderImages}
            onAddClick={() => fileRef.current?.click()}
          />
          <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleFiles} />
        </div>

        {error && (
          <p className="field-error bg-ember/10 border border-ember/20 rounded px-4 py-2.5 text-sm">{error}</p>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Publishing…' : 'Publish'}
          </button>
          <button type="button" onClick={() => router.push('/gallery')} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
