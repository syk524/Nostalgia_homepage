'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadImages } from '@/lib/upload'
import { updatePost } from '@/lib/actions/gallery'
import { CategoryPicker } from '@/components/category-picker'
import { ImageManager } from '@/components/image-manager'
import type { Post, PostImage, Category } from '@/types/database'

type ExistingImage = { kind: 'existing'; url: string; focalX: number; focalY: number }
type NewImage = { kind: 'new'; file: File; preview: string; focalX: number; focalY: number }
type ImageItem = ExistingImage | NewImage

export function EditPostForm({ postId, categories: initialCategories }: { postId: string; categories: Category[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const navigateRef = useRef<HTMLAnchorElement>(null)

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')
  const [categories, setCategories] = useState(initialCategories)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [images, setImages] = useState<ImageItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // router.push() doesn't participate in intercepting-route matching the
  // way an actual <Link> click does (verified: it always hits the
  // canonical route, never the modal) — so once the save lands, click a
  // real, momentarily-rendered Link instead of calling the router directly.
  useEffect(() => {
    if (saved) navigateRef.current?.click()
  }, [saved])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('posts')
      .select('*, images:post_images(*)')
      .eq('id', postId)
      .single()
      .then(({ data }) => {
        const post = data as unknown as (Post & { images: PostImage[] }) | null
        if (post) {
          setTitle(post.title)
          setBody(post.body)
          setCategoryId(post.category_id)
          const sorted = [...(post.images ?? [])].sort((a, b) => a.position - b.position)
          setImages(sorted.map(img => ({ kind: 'existing', url: img.image_url, focalX: img.focal_x, focalY: img.focal_y })))
        }
        setLoading(false)
      })
  }, [postId])

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? [])
    if (!chosen.length) return
    setImages(prev => [...prev, ...chosen.map(file => ({ kind: 'new' as const, file, preview: URL.createObjectURL(file), focalX: 50, focalY: 50 }))])
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

    // No category picked — default to "Etc" instead of blocking the save.
    const effectiveCategoryId = categoryId ?? categories.find(c => c.name === 'Etc')?.id ?? null
    if (!effectiveCategoryId) { setError('Please choose a category.'); setSubmitting(false); return }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('You must be signed in.'); setSubmitting(false); return }

    const newFiles = images.filter((i): i is NewImage => i.kind === 'new').map(i => i.file)

    let uploadedUrls: string[] = []
    if (newFiles.length) {
      const { urls, errors } = await uploadImages(newFiles, user.id, 'gallery-images')
      if (errors.length) { setError(errors[0]); setSubmitting(false); return }
      uploadedUrls = urls
    }

    let uploadIndex = 0
    const imagePayload = images.map(img => img.kind === 'existing'
      ? { url: img.url, focalX: img.focalX, focalY: img.focalY }
      : { url: uploadedUrls[uploadIndex++], focalX: img.focalX, focalY: img.focalY })

    const result = await updatePost(postId, { title, body, images: imagePayload, categoryId: effectiveCategoryId })
    if (result?.error) { setError(result.error); setSubmitting(false); return }
    setSaved(true)
  }

  if (loading) return <p className="text-ink-500">Loading…</p>

  return (
    <div className="animate-fade-up max-w-2xl space-y-6 mx-auto">
      <h2 className="text-3xl text-ink">Edit Post</h2>

      {saved && (
        <Link href={`/gallery/${postId}`} ref={navigateRef} className="hidden" aria-hidden="true">
          go
        </Link>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
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
            images={images.map(i => ({ src: i.kind === 'existing' ? i.url : i.preview, focalX: i.focalX, focalY: i.focalY }))}
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
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => router.push(`/gallery/${postId}`)} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
