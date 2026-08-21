'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateSession } from '@/lib/actions/trpg'
import { TrpgSessionEditor } from '@/components/trpg-session-editor'
import { DotMatrixLoader } from '@/components/dot-matrix-loader'

export function EditSessionForm({ sessionId, initialTitle, initialBody }: {
  sessionId: string
  initialTitle: string
  initialBody: string
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // See gallery/[id]/edit/edit-post-form.tsx's identical field.
  const [closing, setClosing] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const result = await updateSession(sessionId, title, body)
    if (result.error) { setError(result.error); setSubmitting(false); return }
    router.push(`/archive/trpg/${sessionId}`)
  }

  if (closing) return (
    <div className="flex items-center justify-center py-24">
      <DotMatrixLoader size={40} />
    </div>
  )

  return (
    <div className="animate-fade-up max-w-3xl space-y-6">
      <h2 className="text-3xl text-ink">Edit Session</h2>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className="input" value={title}
            onChange={e => setTitle(e.target.value)} placeholder="Session title" required />
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
          <button type="button" onClick={() => { setClosing(true); router.push(`/archive/trpg/${sessionId}`) }} className="btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
