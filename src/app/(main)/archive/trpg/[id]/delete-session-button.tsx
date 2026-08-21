'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteSession } from '@/lib/actions/trpg'

// No modal/interception concern here (unlike gallery's own delete
// button) — plain pages all the way through, so a normal confirm +
// server-action call + router.push is all this needs.
export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    if (!window.confirm('Delete this session? This can’t be undone.')) return
    setDeleting(true)
    const result = await deleteSession(sessionId)
    if (result.error) { setError(result.error); setDeleting(false); return }
    router.push('/archive/trpg')
  }

  return (
    <div>
      <button type="button" onClick={handleDelete} disabled={deleting} className="btn-danger">
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
      {error && <p className="field-error text-xs mt-1.5">{error}</p>}
    </div>
  )
}
