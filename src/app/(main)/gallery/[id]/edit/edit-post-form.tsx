'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadImages } from '@/lib/upload'
import { updatePost } from '@/lib/actions/gallery'
import type { Post, PostImage } from '@/types/database'

type ExistingImage = { kind: 'existing'; url: string }
type NewImage = { kind: 'new'; file: File; preview: string }

export function EditPostForm({ postId }: { postId: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')
  const [images, setImages] = useState<(ExistingImage | NewImage)[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
          const sorted = [...(post.images ?? [])].sort((a, b) => a.position - b.position)
          setImages(sorted.map(img => ({ kind: 'existing', url: img.image_url })))
        }
        setLoading(false)
      })
  }, [postId])

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? [])
    if (!chosen.length) return
    setImages(prev => [...prev, ...chosen.map(file => ({ kind: 'new' as const, file, preview: URL.createObjectURL(file) }))])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('You must be signed in.'); setSubmitting(false); return }

    const existingUrls = images.filter((i): i is ExistingImage => i.kind === 'existing').map(i => i.url)
    const newFiles = images.filter((i): i is NewImage => i.kind === 'new').map(i => i.file)

    let uploadedUrls: string[] = []
    if (newFiles.length) {
      const { urls, errors } = await uploadImages(newFiles, user.id, 'gallery-images')
      if (errors.length) { setError(errors[0]); setSubmitting(false); return }
      uploadedUrls = urls
    }

    const result = await updatePost(postId, title, body, [...existingUrls, ...uploadedUrls])
    if (result?.error) { setError(result.error); setSubmitting(false); return }
    router.refresh()
  }

  if (loading) return <p className="text-ink-500">Loading…</p>

  return (
    <div className="animate-fade-up max-w-2xl space-y-6">
      <h2 className="text-3xl text-ink">Edit Post</h2>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className="input" value={title}
            onChange={e => setTitle(e.target.value)} placeholder="Post title" required />
        </div>

        <div>
          <label className="label" htmlFor="body">Text</label>
          <textarea id="body" className="textarea" rows={8} value={body}
            onChange={e => setBody(e.target.value)} placeholder="Write something…" required />
        </div>

        <div>
          <label className="label">Images</label>
          <div className="flex flex-wrap gap-3">
            {images.map((img, i) => (
              <div key={i} className="relative w-24 h-24 rounded overflow-hidden border border-scroll-300 group">
                <img src={img.kind === 'existing' ? img.url : img.preview} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-24 h-24 rounded border-2 border-dashed border-scroll-300 flex items-center justify-center text-scroll-400 text-2xl hover:border-scroll-400 transition-colors">
              +
            </button>
          </div>
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
