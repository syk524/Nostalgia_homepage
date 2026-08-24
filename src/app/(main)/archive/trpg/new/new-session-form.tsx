'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadImage } from '@/lib/upload'
import { createSession } from '@/lib/actions/trpg'
import { TrpgSessionEditor, deriveCoverUrl } from '@/components/trpg-session-editor'
import { DotMatrixLoader } from '@/components/dot-matrix-loader'
import { PARTICLE_EFFECTS, DEFAULT_PARTICLE_COLORS } from '@/components/particle-effects'
import { ColorSwatch } from '@/components/color-swatch'

export function NewSessionForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [dateRange, setDateRange] = useState('')
  const [description, setDescription] = useState('')
  const [body, setBody] = useState('')
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null)
  const [backgroundPreview, setBackgroundPreview] = useState('')
  const [backgroundBlur, setBackgroundBlur] = useState(1)
  const [particleEffect, setParticleEffect] = useState('')
  const [particleColor, setParticleColor] = useState<string | null>(null)
  const [iconColor, setIconColor] = useState('#2f2f2e')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // See gallery/new/new-post-form.tsx's identical field — Cancel's
  // router.push still has to wait for the destination page's server
  // render, and hiding this form immediately (instead of leaving it
  // visible unchanged for that wait) is what actually fixes the flash.
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

    let backgroundUrl: string | null = null
    if (backgroundFile) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('You must be signed in.'); setSubmitting(false); return }
      const { url, error: uploadErr } = await uploadImage(backgroundFile, user.id, 'trpg-images')
      if (uploadErr) { setError(uploadErr); setSubmitting(false); return }
      backgroundUrl = url
    }

    const coverUrl = deriveCoverUrl(body)
    const result = await createSession({
      title,
      body,
      dateRange: dateRange.trim() || null,
      description: description.trim() || null,
      coverUrl,
      backgroundUrl,
      backgroundBlur,
      particleEffect: particleEffect || null,
      particleColor,
      iconColor,
    })
    if (result.error || !result.slug) { setError(result.error ?? 'Could not create the session.'); setSubmitting(false); return }
    router.push(`/archive/trpg/${result.slug}`)
  }

  if (closing) return (
    <div className="flex items-center justify-center py-24">
      <DotMatrixLoader size={40} />
    </div>
  )

  return (
    <div className="animate-fade-up max-w-3xl mx-auto space-y-6">
      <h2 className="text-3xl text-ink noir-accent-color">New Session</h2>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className="input" value={title}
            onChange={e => setTitle(e.target.value)} placeholder="Session title" required />
        </div>

        {/* Plain text, not a real date input — Roll20's own chat-log HTML
            never carries a machine-readable session date/time anywhere,
            so there's nothing to parse it from; freeform matches
            whatever format the admin actually wants to record here
            ("2026.01.03", "Session 4", a real range, etc). */}
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
              style={{ accentColor: '#2f2f2e' }}
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

        {/* Only shown once an effect is actually picked — an unset
            particleColor renders as that effect's own built-in default
            (DEFAULT_PARTICLE_COLORS in particle-effects.tsx), so there's
            nothing to configure until then. The checkbox is what lets
            someone go back to that default too (rather than the picker
            just starting empty), since a plain color input has no
            "unset" state of its own to fall back to. */}
        {particleEffect && (
          <div>
            <label className="label flex items-center justify-between gap-3">
              <span>Particle color</span>
              <label className="flex items-center gap-1.5 text-xs text-ink-400 normal-case tracking-normal cursor-pointer">
                <input
                  type="checkbox"
                  checked={particleColor !== null}
                  onChange={e => setParticleColor(e.target.checked ? DEFAULT_PARTICLE_COLORS[particleEffect as keyof typeof DEFAULT_PARTICLE_COLORS] : null)}
                />
                Custom
              </label>
            </label>
            {particleColor !== null && (
              <div className="mt-2">
                <ColorSwatch value={particleColor} onChange={setParticleColor} label="Particle color" />
              </div>
            )}
          </div>
        )}

        {/* Same per-page tint concept as the pair profile's own icon
            color picker (character-pair-form.tsx), but wider scope on
            this page — reported directly: also recolors the title, date
            range, and description text on the detail page, not just the
            nav icon/back button/edit-delete controls the pair page's own
            icon color touches. */}
        <div>
          <label className="label">Point color picker</label>
          <ColorSwatch value={iconColor} onChange={setIconColor} />
        </div>

        <div>
          <label className="label">Log</label>
          <TrpgSessionEditor content={body} onChange={setBody} />
        </div>

        {error && <p className="field-error bg-ember/10 border border-ember/20 rounded px-4 py-2.5 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Publishing…' : 'Publish'}
          </button>
          <button type="button" onClick={() => { setClosing(true); router.push('/archive/trpg') }} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
