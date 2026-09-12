'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadImages } from '@/lib/upload'
import { createPost } from '@/lib/actions/gallery'
import { CategoryPicker } from '@/components/category-picker'
import { ImageManager } from '@/components/image-manager'
import { NovelPageEditor } from '@/components/novel-page-editor'
import { DotMatrixLoader } from '@/components/dot-matrix-loader'
import type { Category, PostType } from '@/types/database'

type ImageItem = { file: File; preview: string; focalX: number; focalY: number }
// imageFile null + imageUrl set covers nothing here (a brand-new post has
// no existing uploaded URLs yet) — kept as the same two-field shape as
// edit-post-form.tsx's own novel page state anyway, so both forms' submit
// logic can resolve a page's final image URL identically.
type NovelPageState = { imageFile: File | null; imageUrl: string | null; imagePreview: string; imageCredit: string; isThumbnail: boolean; focalX: number; focalY: number; body: string }

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
  const [postType, setPostType] = useState<PostType>('image')
  const [images, setImages] = useState<ImageItem[]>([])
  const [novelPages, setNovelPages] = useState<NovelPageState[]>([{ imageFile: null, imageUrl: null, imagePreview: '', imageCredit: '', isThumbnail: false, focalX: 50, focalY: 50, body: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdPostId, setCreatedPostId] = useState<string | null>(null)
  // See edit-post-form.tsx's own comment on the identical field — Cancel's
  // router.push('/gallery') still has to wait for that page's server
  // render, and hiding this form immediately (instead of leaving it
  // visible unchanged for that whole wait) is what actually fixes it.
  const [closing, setClosing] = useState(false)

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

  function addNovelPage() {
    setNovelPages(prev => [...prev, { imageFile: null, imageUrl: null, imagePreview: '', imageCredit: '', isThumbnail: false, focalX: 50, focalY: 50, body: '' }])
  }
  function removeNovelPage(index: number) {
    setNovelPages(prev => prev.filter((_, i) => i !== index))
  }
  function moveNovelPage(index: number, direction: -1 | 1) {
    setNovelPages(prev => {
      const to = index + direction
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(to, 0, item)
      return next
    })
  }
  function setNovelPageBody(index: number, value: string) {
    setNovelPages(prev => prev.map((p, i) => i === index ? { ...p, body: value } : p))
  }
  function setNovelPageImage(index: number, file: File) {
    setNovelPages(prev => prev.map((p, i) => i === index ? { ...p, imageFile: file, imagePreview: URL.createObjectURL(file) } : p))
  }
  function removeNovelPageImage(index: number) {
    setNovelPages(prev => prev.map((p, i) => i === index ? { ...p, imageFile: null, imageUrl: null, imagePreview: '', imageCredit: '', isThumbnail: false, focalX: 50, focalY: 50 } : p))
  }
  function setNovelPageCredit(index: number, value: string) {
    setNovelPages(prev => prev.map((p, i) => i === index ? { ...p, imageCredit: value } : p))
  }
  // Exclusive, like character-pair-form.tsx's own primary-profile star —
  // clearing every other page's flag here (rather than relying on
  // gallery-grid.tsx to just pick "the first" if several came in true) is
  // what keeps a single flip always resolving to exactly one thumbnail.
  function setNovelPageThumbnail(index: number) {
    setNovelPages(prev => prev.map((p, i) => ({ ...p, isThumbnail: i === index })))
  }
  function setNovelPageFocal(index: number, x: number, y: number) {
    setNovelPages(prev => prev.map((p, i) => i === index ? { ...p, focalX: x, focalY: y } : p))
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
    let pagePayload: { imageUrl: string | null; imageCredit: string; isThumbnail: boolean; focalX: number; focalY: number; body: string }[] = []
    if (postType === 'novel') {
      const filesToUpload = novelPages.filter(p => p.imageFile).map(p => p.imageFile!)
      let uploadedUrls: string[] = []
      if (filesToUpload.length) {
        const { urls, errors } = await uploadImages(filesToUpload, user.id, 'gallery-images')
        if (errors.length) { setError(errors[0]); setSubmitting(false); return }
        uploadedUrls = urls
      }
      let uploadCursor = 0
      pagePayload = novelPages.map(p => ({
        imageUrl: p.imageFile ? uploadedUrls[uploadCursor++] : p.imageUrl,
        imageCredit: p.imageCredit,
        isThumbnail: p.isThumbnail,
        focalX: p.focalX,
        focalY: p.focalY,
        body: p.body,
      }))
    } else if (images.length) {
      const { urls, errors } = await uploadImages(images.map(i => i.file), user.id, 'gallery-images')
      if (errors.length) { setError(errors[0]); setSubmitting(false); return }
      imagePayload = urls.map((url, i) => ({ url, focalX: images[i].focalX, focalY: images[i].focalY }))
    }

    const result = await createPost({ title, body, postType, images: imagePayload, pages: pagePayload, categoryId: effectiveCategoryId })
    if (result?.error || !result?.postId) { setError(result?.error ?? 'Could not create the post.'); setSubmitting(false); return }
    setCreatedPostId(result.postId)
  }

  if (closing) return (
    <div className="flex items-center justify-center py-24">
      <DotMatrixLoader size={40} />
    </div>
  )

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
          <label className="label">Post Type</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPostType('image')} className={postType === 'image' ? 'btn-primary text-xs' : 'btn-ghost text-xs'}>
              Image
            </button>
            <button type="button" onClick={() => setPostType('novel')} className={postType === 'novel' ? 'btn-primary text-xs' : 'btn-ghost text-xs'}>
              Novel
            </button>
          </div>
        </div>

        {postType === 'novel' ? (
          <div>
            <label className="label">Pages</label>
            <NovelPageEditor
              pages={novelPages.map(p => ({ imagePreview: p.imagePreview || p.imageUrl, imageCredit: p.imageCredit, isThumbnail: p.isThumbnail, focalX: p.focalX, focalY: p.focalY, body: p.body }))}
              onBodyChange={setNovelPageBody}
              onImageSelect={setNovelPageImage}
              onImageRemove={removeNovelPageImage}
              onCreditChange={setNovelPageCredit}
              onSetThumbnail={setNovelPageThumbnail}
              onFocalChange={setNovelPageFocal}
              onAdd={addNovelPage}
              onRemove={removeNovelPage}
              onMove={moveNovelPage}
            />
          </div>
        ) : (
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
        )}

        {error && (
          <p className="field-error bg-ember/10 border border-ember/20 rounded px-4 py-2.5 text-sm">{error}</p>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Publishing…' : 'Publish'}
          </button>
          <button type="button" onClick={() => { setClosing(true); router.push('/gallery') }} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
