'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadImages } from '@/lib/upload'
import { createPost } from '@/lib/actions/gallery'

export function NewPostForm() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? [])
    if (!chosen.length) return
    setFiles(prev => [...prev, ...chosen])
    setPreviews(prev => [...prev, ...chosen.map(f => URL.createObjectURL(f))])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeImage(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('You must be signed in.'); setSubmitting(false); return }

    let imageUrls: string[] = []
    if (files.length) {
      const { urls, errors } = await uploadImages(files, user.id, 'gallery-images')
      if (errors.length) { setError(errors[0]); setSubmitting(false); return }
      imageUrls = urls
    }

    const result = await createPost(title, body, imageUrls)
    if (result?.error) { setError(result.error); setSubmitting(false); return }
    // createPost redirects to the new post on success — router.refresh is a fallback
    router.refresh()
  }

  return (
    <div className="animate-fade-up max-w-2xl space-y-6">
      <h2 className="text-3xl text-ink">New Post</h2>

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
            {previews.map((src, i) => (
              <div key={src} className="relative w-24 h-24 rounded overflow-hidden border border-scroll-300 group">
                <img src={src} alt="" className="w-full h-full object-cover" />
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
