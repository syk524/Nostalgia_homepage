'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadImage } from '@/lib/upload'
import { updateSession } from '@/lib/actions/trpg'
import { TrpgSessionEditor, deriveCoverUrl } from '@/components/trpg-session-editor'
import { DotMatrixLoader } from '@/components/dot-matrix-loader'
import { PARTICLE_EFFECTS } from '@/components/particle-effects'

export function EditSessionForm({ sessionId, initialSlug, initialTitle, initialDateRange, initialDescription, initialBody, initialBackgroundUrl, initialBackgroundBlur, initialParticleEffect }: {
  sessionId: string
  initialSlug: string
  initialTitle: string
  initialDateRange: string | null
  initialDescription: string | null
  initialBody: string
  initialBackgroundUrl: string | null
  initialBackgroundBlur: number
  initialParticleEffect: string | null
}) {
  const router = useRouter()
  // Not state — the back button/Cancel only ever need the slug this page
  // loaded with. A successful save navigates away immediately (using the
  // server's returned slug, which may differ if the new title collided
  // with another session and got a numeric suffix), so there's no
  // "still on this page with a stale slug" case to keep in sync for.
  const slug = initialSlug
  const [title, setTitle] = useState(initialTitle)
  const [dateRange, setDateRange] = useState(initialDateRange ?? '')
  const [description, setDescription] = useState(initialDescription ?? '')
  const [body, setBody] = useState(initialBody)
  const [backgroundUrl, setBackgroundUrl] = useState(initialBackgroundUrl)
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null)
  const [backgroundPreview, setBackgroundPreview] = useState(initialBackgroundUrl ?? '')
  const [backgroundBlur, setBackgroundBlur] = useState(initialBackgroundBlur)
  const [particleEffect, setParticleEffect] = useState(initialParticleEffect ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // See gallery/[id]/edit/edit-post-form.tsx's identical field.
  const [closing, setClosing] = useState(false)

  function handleBackgroundChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBackgroundFile(file)
    setBackgroundPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    let finalBackgroundUrl = backgroundUrl
    if (backgroundFile) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('You must be signed in.'); setSubmitting(false); return }
      const { url, error: uploadErr } = await uploadImage(backgroundFile, user.id, 'trpg-images')
      if (uploadErr) { setError(uploadErr); setSubmitting(false); return }
      finalBackgroundUrl = url
    }

    const coverUrl = deriveCoverUrl(body)
    const result = await updateSession(sessionId, {
      title,
      body,
      dateRange: dateRange.trim() || null,
      description: description.trim() || null,
      coverUrl,
      backgroundUrl: finalBackgroundUrl,
      backgroundBlur,
      particleEffect: particleEffect || null,
    })
    if (result.error || !result.slug) { setError(result.error ?? 'Could not save the session.'); setSubmitting(false); return }
    router.push(`/archive/trpg/${result.slug}`)
  }

  if (closing) return (
    <div className="flex items-center justify-center py-24">
      <DotMatrixLoader size={40} />
    </div>
  )

  return (
    <>
      {/* Same fixed, icon-only back button as the session detail page
          (archive/trpg/[slug]/page.tsx) — back to that same detail page
          here, not the list, since that's where Edit was reached from. */}
      <Link
        href={`/archive/trpg/${slug}`}
        aria-label="Back to session"
        className="fixed left-[2.6%] top-[3%] z-[60] inline-flex w-8 h-8 rounded-full items-center justify-start text-ink-400 hover:opacity-70 transition-opacity"
      >
        <ArrowLeft size={18} />
      </Link>

      <div className="animate-fade-up max-w-3xl mx-auto space-y-6">
        <h2 className="text-3xl text-ink">Edit Session</h2>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div>
            <label className="label" htmlFor="title">Title</label>
            <input id="title" className="input" value={title}
              onChange={e => setTitle(e.target.value)} placeholder="Session title" required />
          </div>

          {/* Plain text, not a real date input — Roll20's own chat-log
              HTML never carries a machine-readable session date/time
              anywhere, so there's nothing to parse it from; freeform
              matches whatever format the admin actually wants to record
              here ("2026.01.03", "Session 4", a real range, etc). */}
          <div>
            <label className="label" htmlFor="date-range">Date range</label>
            <input id="date-range" className="input" value={dateRange}
              onChange={e => setDateRange(e.target.value)} placeholder="e.g. 2026.01.03 - 2026.01.10" />
          </div>

          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" className="textarea" rows={2} value={description}
              onChange={e => setDescription(e.target.value)} placeholder="A short summary of this session" />
          </div>

          {/* Same pattern as the pair-profile background picker
              (character-pair-form.tsx) — a preview tile + file input, plus
              a 1-100 blur-strength slider mapped onto a 0-40px CSS blur
              radius at render time (archive/trpg/[id]/page.tsx). Uploads to
              the trpg-images bucket used elsewhere in this editor. */}
          <div>
            <label className="label">Background</label>
            <div className="flex items-center gap-4">
              <div className="w-32 aspect-video rounded border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
                {backgroundPreview
                  ? <img src={backgroundPreview} alt="" className="w-full h-full object-cover" />
                  : <span className="text-2xl text-scroll-400">◯</span>
                }
              </div>
              <label className="btn-ghost text-xs cursor-pointer">
                Choose image
                <input type="file" accept="image/*" onChange={handleBackgroundChange} className="sr-only" />
              </label>
            </div>
            <div className="mt-3">
              <label className="label flex items-center justify-between" htmlFor="background-blur">
                <span>Background image blur strength</span>
                <span className="text-ink-500 normal-case tracking-normal">{backgroundBlur}%</span>
              </label>
              <input
                id="background-blur"
                type="range"
                min={1}
                max={100}
                step={1}
                value={backgroundBlur}
                onChange={e => setBackgroundBlur(Number(e.target.value))}
                className="w-full block"
                style={{ accentColor: '#5c574d' }}
              />
            </div>
          </div>

          {/* A dropdown, not a checkbox — reported directly: more effects
              (snow, embers, …) are coming, so this needs to be a choice
              among options from the start, not a boolean that would later
              need reworking into one. Renders behind the log card but on
              top of the background image (see particle-effects.tsx and
              [slug]/page.tsx). */}
          <div>
            <label className="label" htmlFor="particle-effect">Particle effect</label>
            <select
              id="particle-effect"
              className="input"
              value={particleEffect}
              onChange={e => setParticleEffect(e.target.value)}
            >
              <option value="">None</option>
              {PARTICLE_EFFECTS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Log</label>
            <TrpgSessionEditor content={body} onChange={setBody} />
          </div>

          {error && <p className="field-error bg-ember/10 border border-ember/20 rounded px-4 py-2.5 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => { setClosing(true); router.push(`/archive/trpg/${slug}`) }} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
